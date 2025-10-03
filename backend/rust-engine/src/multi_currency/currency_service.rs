use crate::multi_currency::exchange_rates::{ExchangeRate, ExchangeRateProvider};
use crate::multi_currency::fiat_providers::{
    AirtelMoneyProvider, FiatProvider, MTNProvider, MpesaProvider,
};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, instrument, warn};

/// Supported African currencies
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Currency {
    KES, // Kenyan Shilling
    TZS, // Tanzanian Shilling
    UGX, // Ugandan Shilling
    NGN, // Nigerian Naira
    ZAR, // South African Rand
    GHS, // Ghanaian Cedi
    ETB, // Ethiopian Birr
    MWK, // Malawian Kwacha
    ZMW, // Zambian Kwacha
    BWP, // Botswanan Pula
}

impl Currency {
    /// Get currency code as string
    pub fn code(&self) -> &'static str {
        match self {
            Currency::KES => "KES",
            Currency::TZS => "TZS",
            Currency::UGX => "UGX",
            Currency::NGN => "NGN",
            Currency::ZAR => "ZAR",
            Currency::GHS => "GHS",
            Currency::ETB => "ETB",
            Currency::MWK => "MWK",
            Currency::ZMW => "ZMW",
            Currency::BWP => "BWP",
        }
    }

    /// Get currency name
    pub fn name(&self) -> &'static str {
        match self {
            Currency::KES => "Kenyan Shilling",
            Currency::TZS => "Tanzanian Shilling",
            Currency::UGX => "Ugandan Shilling",
            Currency::NGN => "Nigerian Naira",
            Currency::ZAR => "South African Rand",
            Currency::GHS => "Ghanaian Cedi",
            Currency::ETB => "Ethiopian Birr",
            Currency::MWK => "Malawian Kwacha",
            Currency::ZMW => "Zambian Kwacha",
            Currency::BWP => "Botswanan Pula",
        }
    }

    /// Get currency symbol
    pub fn symbol(&self) -> &'static str {
        match self {
            Currency::KES => "KSh",
            Currency::TZS => "TSh",
            Currency::UGX => "USh",
            Currency::NGN => "₦",
            Currency::ZAR => "R",
            Currency::GHS => "₵",
            Currency::ETB => "Br",
            Currency::MWK => "MK",
            Currency::ZMW => "ZK",
            Currency::BWP => "P",
        }
    }

    /// Get minimum transaction amount in sats
    pub fn min_sats(&self) -> u64 {
        match self {
            Currency::KES => 100, // ~$0.01
            Currency::TZS => 250, // ~$0.01
            Currency::UGX => 250, // ~$0.01
            Currency::NGN => 50,  // ~$0.01
            Currency::ZAR => 50,  // ~$0.01
            Currency::GHS => 50,  // ~$0.01
            Currency::ETB => 50,  // ~$0.01
            Currency::MWK => 100, // ~$0.01
            Currency::ZMW => 50,  // ~$0.01
            Currency::BWP => 50,  // ~$0.01
        }
    }

    /// Get maximum transaction amount in sats
    pub fn max_sats(&self) -> u64 {
        match self {
            Currency::KES => 1_000_000, // ~$100
            Currency::TZS => 2_500_000, // ~$100
            Currency::UGX => 2_500_000, // ~$100
            Currency::NGN => 500_000,   // ~$100
            Currency::ZAR => 500_000,   // ~$100
            Currency::GHS => 500_000,   // ~$100
            Currency::ETB => 500_000,   // ~$100
            Currency::MWK => 1_000_000, // ~$100
            Currency::ZMW => 500_000,   // ~$100
            Currency::BWP => 500_000,   // ~$100
        }
    }
}

/// Multi-currency service for SatsConnect
#[derive(Debug)]
pub struct CurrencyService {
    exchange_rates: Arc<RwLock<HashMap<Currency, ExchangeRate>>>,
    fiat_providers: HashMap<Currency, Box<dyn FiatProvider + Send + Sync>>,
    exchange_provider: Arc<dyn ExchangeRateProvider + Send + Sync>,
}

impl CurrencyService {
    /// Create a new currency service
    pub fn new() -> Self {
        let mut fiat_providers: HashMap<Currency, Box<dyn FiatProvider + Send + Sync>> =
            HashMap::new();

        // Initialize fiat providers for each currency
        fiat_providers.insert(Currency::KES, Box::new(MpesaProvider::new()));
        fiat_providers.insert(Currency::TZS, Box::new(AirtelMoneyProvider::new()));
        fiat_providers.insert(Currency::UGX, Box::new(MTNProvider::new()));
        fiat_providers.insert(Currency::NGN, Box::new(MTNProvider::new()));
        fiat_providers.insert(Currency::ZAR, Box::new(MTNProvider::new()));
        fiat_providers.insert(Currency::GHS, Box::new(MTNProvider::new()));
        fiat_providers.insert(Currency::ETB, Box::new(MTNProvider::new()));
        fiat_providers.insert(Currency::MWK, Box::new(MTNProvider::new()));
        fiat_providers.insert(Currency::ZMW, Box::new(MTNProvider::new()));
        fiat_providers.insert(Currency::BWP, Box::new(MTNProvider::new()));

        Self {
            exchange_rates: Arc::new(RwLock::new(HashMap::new())),
            fiat_providers,
            exchange_provider: Arc::new(ExchangeRateProvider::new()),
        }
    }

    /// Get exchange rate for a currency
    #[instrument(skip(self))]
    pub async fn get_exchange_rate(&self, currency: Currency) -> Result<ExchangeRate> {
        // Check cache first
        {
            let rates = self.exchange_rates.read().await;
            if let Some(rate) = rates.get(&currency) {
                if !rate.is_expired() {
                    return Ok(rate.clone());
                }
            }
        }

        // Fetch fresh rate
        let rate = self.exchange_provider.get_rate(currency).await?;

        // Update cache
        {
            let mut rates = self.exchange_rates.write().await;
            rates.insert(currency, rate.clone());
        }

        info!(
            "Exchange rate for {}: {} sats per {}",
            currency.code(),
            rate.rate,
            currency.code()
        );
        Ok(rate)
    }

    /// Convert sats to fiat amount
    #[instrument(skip(self))]
    pub async fn sats_to_fiat(&self, sats: u64, currency: Currency) -> Result<f64> {
        let rate = self.get_exchange_rate(currency).await?;
        let fiat_amount = sats as f64 / rate.rate;
        Ok(fiat_amount)
    }

    /// Convert fiat amount to sats
    #[instrument(skip(self))]
    pub async fn fiat_to_sats(&self, fiat_amount: f64, currency: Currency) -> Result<u64> {
        let rate = self.get_exchange_rate(currency).await?;
        let sats = (fiat_amount * rate.rate) as u64;

        // Validate amount limits
        if sats < currency.min_sats() {
            return Err(anyhow::anyhow!(
                "Amount too small. Minimum: {} sats",
                currency.min_sats()
            ));
        }
        if sats > currency.max_sats() {
            return Err(anyhow::anyhow!(
                "Amount too large. Maximum: {} sats",
                currency.max_sats()
            ));
        }

        Ok(sats)
    }

    /// Get supported currencies
    pub fn get_supported_currencies(&self) -> Vec<Currency> {
        vec![
            Currency::KES,
            Currency::TZS,
            Currency::UGX,
            Currency::NGN,
            Currency::ZAR,
            Currency::GHS,
            Currency::ETB,
            Currency::MWK,
            Currency::ZMW,
            Currency::BWP,
        ]
    }

    /// Get fiat provider for currency
    pub fn get_fiat_provider(&self, currency: Currency) -> Option<&dyn FiatProvider> {
        self.fiat_providers.get(&currency).map(|p| p.as_ref())
    }

    /// Get currency by code
    pub fn from_code(code: &str) -> Result<Currency> {
        match code.to_uppercase().as_str() {
            "KES" => Ok(Currency::KES),
            "TZS" => Ok(Currency::TZS),
            "UGX" => Ok(Currency::UGX),
            "NGN" => Ok(Currency::NGN),
            "ZAR" => Ok(Currency::ZAR),
            "GHS" => Ok(Currency::GHS),
            "ETB" => Ok(Currency::ETB),
            "MWK" => Ok(Currency::MWK),
            "ZMW" => Ok(Currency::ZMW),
            "BWP" => Ok(Currency::BWP),
            _ => Err(anyhow::anyhow!("Unsupported currency code: {}", code)),
        }
    }

    /// Get currency information
    pub fn get_currency_info(&self, currency: Currency) -> CurrencyInfo {
        CurrencyInfo {
            code: currency.code().to_string(),
            name: currency.name().to_string(),
            symbol: currency.symbol().to_string(),
            min_sats: currency.min_sats(),
            max_sats: currency.max_sats(),
        }
    }

    /// Refresh all exchange rates
    #[instrument(skip(self))]
    pub async fn refresh_all_rates(&self) -> Result<()> {
        info!("Refreshing all exchange rates");

        let currencies = self.get_supported_currencies();
        let mut rates = self.exchange_rates.write().await;

        for currency in currencies {
            match self.exchange_provider.get_rate(currency).await {
                Ok(rate) => {
                    rates.insert(currency, rate);
                    info!("Updated rate for {}", currency.code());
                }
                Err(e) => {
                    error!("Failed to update rate for {}: {}", currency.code(), e);
                }
            }
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyInfo {
    pub code: String,
    pub name: String,
    pub symbol: String,
    pub min_sats: u64,
    pub max_sats: u64,
}

impl Default for CurrencyService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_currency_service_creation() {
        let service = CurrencyService::new();
        let currencies = service.get_supported_currencies();
        assert_eq!(currencies.len(), 10);
    }

    #[test]
    fn test_currency_from_code() {
        assert_eq!(CurrencyService::from_code("KES").unwrap(), Currency::KES);
        assert_eq!(CurrencyService::from_code("TZS").unwrap(), Currency::TZS);
        assert!(CurrencyService::from_code("INVALID").is_err());
    }

    #[test]
    fn test_currency_info() {
        let service = CurrencyService::new();
        let info = service.get_currency_info(Currency::KES);
        assert_eq!(info.code, "KES");
        assert_eq!(info.name, "Kenyan Shilling");
        assert_eq!(info.symbol, "KSh");
    }
}
