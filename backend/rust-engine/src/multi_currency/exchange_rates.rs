use super::currency_service::Currency;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, instrument, warn};

/// Exchange rate data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeRate {
    pub currency: Currency,
    pub rate: f64, // sats per unit of currency
    pub timestamp: u64,
    pub source: String,
    pub ttl: u64, // time to live in seconds
}

impl ExchangeRate {
    /// Check if the rate is expired
    pub fn is_expired(&self) -> bool {
        let now = chrono::Utc::now().timestamp() as u64;
        now > self.timestamp + self.ttl
    }

    /// Get age in seconds
    pub fn age_seconds(&self) -> u64 {
        let now = chrono::Utc::now().timestamp() as u64;
        now - self.timestamp
    }
}

/// Exchange rate provider trait
pub trait ExchangeRateProvider: Send + Sync {
    async fn get_rate(&self, currency: Currency) -> Result<ExchangeRate>;
    async fn get_rates(&self, currencies: Vec<Currency>)
        -> Result<HashMap<Currency, ExchangeRate>>;
}

/// Multi-source exchange rate provider
#[derive(Debug)]
pub struct MultiSourceExchangeRateProvider {
    providers: Vec<Box<dyn ExchangeRateProvider + Send + Sync>>,
    cache: Arc<RwLock<HashMap<Currency, ExchangeRate>>>,
}

impl MultiSourceExchangeRateProvider {
    pub fn new() -> Self {
        Self {
            providers: Vec::new(),
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn add_provider(&mut self, provider: Box<dyn ExchangeRateProvider + Send + Sync>) {
        self.providers.push(provider);
    }
}

#[async_trait::async_trait]
impl ExchangeRateProvider for MultiSourceExchangeRateProvider {
    async fn get_rate(&self, currency: Currency) -> Result<ExchangeRate> {
        // Try cache first
        {
            let cache = self.cache.read().await;
            if let Some(rate) = cache.get(&currency) {
                if !rate.is_expired() {
                    return Ok(rate.clone());
                }
            }
        }

        // Try each provider until one succeeds
        for provider in &self.providers {
            match provider.get_rate(currency).await {
                Ok(rate) => {
                    // Cache the rate
                    {
                        let mut cache = self.cache.write().await;
                        cache.insert(currency, rate.clone());
                    }
                    return Ok(rate);
                }
                Err(e) => {
                    warn!("Provider failed for {}: {}", currency.code(), e);
                    continue;
                }
            }
        }

        Err(anyhow::anyhow!(
            "All exchange rate providers failed for {}",
            currency.code()
        ))
    }

    async fn get_rates(
        &self,
        currencies: Vec<Currency>,
    ) -> Result<HashMap<Currency, ExchangeRate>> {
        let mut rates = HashMap::new();

        for currency in currencies {
            match self.get_rate(currency).await {
                Ok(rate) => {
                    rates.insert(currency, rate);
                }
                Err(e) => {
                    error!("Failed to get rate for {}: {}", currency.code(), e);
                }
            }
        }

        Ok(rates)
    }
}

/// CoinGecko exchange rate provider
#[derive(Debug)]
pub struct CoinGeckoProvider {
    client: reqwest::Client,
    base_url: String,
}

impl CoinGeckoProvider {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: "https://api.coingecko.com/api/v3".to_string(),
        }
    }

    fn get_coin_id(&self, currency: Currency) -> &'static str {
        match currency {
            Currency::KES => "bitcoin",
            Currency::TZS => "bitcoin",
            Currency::UGX => "bitcoin",
            Currency::NGN => "bitcoin",
            Currency::ZAR => "bitcoin",
            Currency::GHS => "bitcoin",
            Currency::ETB => "bitcoin",
            Currency::MWK => "bitcoin",
            Currency::ZMW => "bitcoin",
            Currency::BWP => "bitcoin",
        }
    }

    fn get_currency_code(&self, currency: Currency) -> &'static str {
        currency.code()
    }
}

#[async_trait::async_trait]
impl ExchangeRateProvider for CoinGeckoProvider {
    async fn get_rate(&self, currency: Currency) -> Result<ExchangeRate> {
        let coin_id = self.get_coin_id(currency);
        let currency_code = self.get_currency_code(currency);

        let url = format!(
            "{}/simple/price?ids={}&vs_currencies={}&include_24hr_change=true",
            self.base_url, coin_id, currency_code
        );

        info!("Fetching exchange rate from CoinGecko: {}", url);

        let response = self
            .client
            .get(&url)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "CoinGecko API error: {}",
                response.status()
            ));
        }

        let data: serde_json::Value = response.json().await?;

        let price = data[coin_id][currency_code]
            .as_f64()
            .ok_or_else(|| anyhow::anyhow!("Invalid price data from CoinGecko"))?;

        // Convert to sats per currency unit
        let rate = price / 100_000_000.0; // 1 BTC = 100,000,000 sats

        Ok(ExchangeRate {
            currency,
            rate,
            timestamp: chrono::Utc::now().timestamp() as u64,
            source: "CoinGecko".to_string(),
            ttl: 300, // 5 minutes
        })
    }

    async fn get_rates(
        &self,
        currencies: Vec<Currency>,
    ) -> Result<HashMap<Currency, ExchangeRate>> {
        let mut rates = HashMap::new();

        for currency in currencies {
            match self.get_rate(currency).await {
                Ok(rate) => {
                    rates.insert(currency, rate);
                }
                Err(e) => {
                    error!(
                        "Failed to get rate for {} from CoinGecko: {}",
                        currency.code(),
                        e
                    );
                }
            }
        }

        Ok(rates)
    }
}

/// Binance exchange rate provider
#[derive(Debug)]
pub struct BinanceProvider {
    client: reqwest::Client,
    base_url: String,
}

impl BinanceProvider {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: "https://api.binance.com/api/v3".to_string(),
        }
    }

    fn get_symbol(&self, currency: Currency) -> String {
        format!("BTC{}", currency.code())
    }
}

#[async_trait::async_trait]
impl ExchangeRateProvider for BinanceProvider {
    async fn get_rate(&self, currency: Currency) -> Result<ExchangeRate> {
        let symbol = self.get_symbol(currency);
        let url = format!("{}/ticker/price?symbol={}", self.base_url, symbol);

        info!("Fetching exchange rate from Binance: {}", url);

        let response = self
            .client
            .get(&url)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Binance API error: {}", response.status()));
        }

        let data: serde_json::Value = response.json().await?;

        let price = data["price"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid price data from Binance"))?
            .parse::<f64>()?;

        // Convert to sats per currency unit
        let rate = price / 100_000_000.0; // 1 BTC = 100,000,000 sats

        Ok(ExchangeRate {
            currency,
            rate,
            timestamp: chrono::Utc::now().timestamp() as u64,
            source: "Binance".to_string(),
            ttl: 60, // 1 minute
        })
    }

    async fn get_rates(
        &self,
        currencies: Vec<Currency>,
    ) -> Result<HashMap<Currency, ExchangeRate>> {
        let mut rates = HashMap::new();

        for currency in currencies {
            match self.get_rate(currency).await {
                Ok(rate) => {
                    rates.insert(currency, rate);
                }
                Err(e) => {
                    error!(
                        "Failed to get rate for {} from Binance: {}",
                        currency.code(),
                        e
                    );
                }
            }
        }

        Ok(rates)
    }
}

/// Default exchange rate provider (uses multiple sources)
#[derive(Debug)]
pub struct DefaultExchangeRateProvider {
    multi_provider: MultiSourceExchangeRateProvider,
}

impl DefaultExchangeRateProvider {
    pub fn new() -> Self {
        let mut multi_provider = MultiSourceExchangeRateProvider::new();

        // Add multiple providers for redundancy
        multi_provider.add_provider(Box::new(CoinGeckoProvider::new()));
        multi_provider.add_provider(Box::new(BinanceProvider::new()));

        Self { multi_provider }
    }
}

#[async_trait::async_trait]
impl ExchangeRateProvider for DefaultExchangeRateProvider {
    async fn get_rate(&self, currency: Currency) -> Result<ExchangeRate> {
        self.multi_provider.get_rate(currency).await
    }

    async fn get_rates(
        &self,
        currencies: Vec<Currency>,
    ) -> Result<HashMap<Currency, ExchangeRate>> {
        self.multi_provider.get_rates(currencies).await
    }
}

// Alias for the default provider
pub type ExchangeRateProvider = DefaultExchangeRateProvider;

impl ExchangeRateProvider {
    pub fn new() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_coin_gecko_provider() {
        let provider = CoinGeckoProvider::new();
        let rate = provider.get_rate(Currency::KES).await;
        assert!(rate.is_ok());

        if let Ok(rate) = rate {
            assert!(rate.rate > 0.0);
            assert_eq!(rate.currency, Currency::KES);
            assert_eq!(rate.source, "CoinGecko");
        }
    }

    #[test]
    fn test_exchange_rate_expiry() {
        let rate = ExchangeRate {
            currency: Currency::KES,
            rate: 1000.0,
            timestamp: chrono::Utc::now().timestamp() as u64 - 400, // 400 seconds ago
            source: "Test".to_string(),
            ttl: 300, // 5 minutes
        };

        assert!(rate.is_expired());
    }
}
