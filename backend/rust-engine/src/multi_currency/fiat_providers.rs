use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, error, warn, instrument};

/// Fiat provider trait for different payment methods
pub trait FiatProvider: Send + Sync {
    async fn initiate_payment(&self, amount: f64, phone: &str, reference: &str) -> Result<PaymentResponse>;
    async fn verify_payment(&self, transaction_id: &str) -> Result<PaymentStatus>;
    async fn get_limits(&self) -> Result<PaymentLimits>;
    fn get_provider_name(&self) -> &'static str;
    fn get_supported_currencies(&self) -> Vec<&'static str>;
}

/// Payment response from fiat provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentResponse {
    pub success: bool,
    pub transaction_id: Option<String>,
    pub message: String,
    pub error_code: Option<String>,
    pub requires_otp: bool,
    pub otp_message: Option<String>,
}

/// Payment status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentStatus {
    pub transaction_id: String,
    pub status: PaymentState,
    pub amount: f64,
    pub phone: String,
    pub reference: String,
    pub timestamp: u64,
    pub error_message: Option<String>,
}

/// Payment state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PaymentState {
    Pending,
    Processing,
    Completed,
    Failed,
    Cancelled,
    Expired,
}

/// Payment limits
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentLimits {
    pub min_amount: f64,
    pub max_amount: f64,
    pub daily_limit: f64,
    pub monthly_limit: f64,
    pub currency: String,
}

/// MPesa provider for Kenya
#[derive(Debug)]
pub struct MpesaProvider {
    consumer_key: String,
    consumer_secret: String,
    business_short_code: String,
    passkey: String,
    callback_url: String,
    environment: String, // "sandbox" or "production"
}

impl MpesaProvider {
    pub fn new() -> Self {
        Self {
            consumer_key: std::env::var("MPESA_CONSUMER_KEY").unwrap_or_else(|_| "test_key".to_string()),
            consumer_secret: std::env::var("MPESA_CONSUMER_SECRET").unwrap_or_else(|_| "test_secret".to_string()),
            business_short_code: std::env::var("MPESA_BUSINESS_SHORT_CODE").unwrap_or_else(|_| "174379".to_string()),
            passkey: std::env::var("MPESA_PASSKEY").unwrap_or_else(|_| "test_passkey".to_string()),
            callback_url: std::env::var("MPESA_CALLBACK_URL").unwrap_or_else(|_| "https://api.satsconnect.com/webhooks/mpesa".to_string()),
            environment: std::env::var("MPESA_ENVIRONMENT").unwrap_or_else(|_| "sandbox".to_string()),
        }
    }

    async fn get_access_token(&self) -> Result<String> {
        let auth = base64::encode(format!("{}:{}", self.consumer_key, self.consumer_secret));
        
        let client = reqwest::Client::new();
        let response = client
            .get(&format!(
                "https://{}.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
                if self.environment == "production" { "api" } else { "sandbox" }
            ))
            .header("Authorization", format!("Basic {}", auth))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to get MPesa access token"));
        }

        let data: serde_json::Value = response.json().await?;
        let access_token = data["access_token"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid access token response"))?;

        Ok(access_token.to_string())
    }

    fn generate_password(&self, timestamp: &str) -> String {
        let password_string = format!("{}{}{}", self.business_short_code, self.passkey, timestamp);
        base64::encode(password_string)
    }
}

#[async_trait::async_trait]
impl FiatProvider for MpesaProvider {
    async fn initiate_payment(&self, amount: f64, phone: &str, reference: &str) -> Result<PaymentResponse> {
        info!("Initiating MPesa payment: {} KES to {}", amount, phone);

        let access_token = self.get_access_token().await?;
        let timestamp = chrono::Utc::now().format("%Y%m%d%H%M%S").to_string();
        let password = self.generate_password(&timestamp);

        let payload = serde_json::json!({
            "BusinessShortCode": self.business_short_code,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": amount as i32,
            "PartyA": phone,
            "PartyB": self.business_short_code,
            "PhoneNumber": phone,
            "CallBackURL": self.callback_url,
            "AccountReference": reference,
            "TransactionDesc": "SatsConnect Bitcoin Purchase"
        });

        let client = reqwest::Client::new();
        let response = client
            .post(&format!(
                "https://{}.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
                if self.environment == "production" { "api" } else { "sandbox" }
            ))
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            return Ok(PaymentResponse {
                success: false,
                transaction_id: None,
                message: "Failed to initiate MPesa payment".to_string(),
                error_code: Some("API_ERROR".to_string()),
                requires_otp: false,
                otp_message: None,
            });
        }

        let data: serde_json::Value = response.json().await?;
        
        if data["ResponseCode"].as_str() == Some("0") {
            Ok(PaymentResponse {
                success: true,
                transaction_id: data["CheckoutRequestID"].as_str().map(|s| s.to_string()),
                message: data["CustomerMessage"].as_str().unwrap_or("Payment initiated").to_string(),
                error_code: None,
                requires_otp: true,
                otp_message: Some("Please check your phone and enter the MPesa PIN to complete the payment".to_string()),
            })
        } else {
            Ok(PaymentResponse {
                success: false,
                transaction_id: None,
                message: data["CustomerMessage"].as_str().unwrap_or("Payment failed").to_string(),
                error_code: data["ResponseCode"].as_str().map(|s| s.to_string()),
                requires_otp: false,
                otp_message: None,
            })
        }
    }

    async fn verify_payment(&self, transaction_id: &str) -> Result<PaymentStatus> {
        // In a real implementation, this would query MPesa's transaction status API
        // For now, we'll return a mock status
        Ok(PaymentStatus {
            transaction_id: transaction_id.to_string(),
            status: PaymentState::Completed,
            amount: 0.0, // Would be fetched from API
            phone: "".to_string(), // Would be fetched from API
            reference: "".to_string(), // Would be fetched from API
            timestamp: chrono::Utc::now().timestamp() as u64,
            error_message: None,
        })
    }

    async fn get_limits(&self) -> Result<PaymentLimits> {
        Ok(PaymentLimits {
            min_amount: 1.0,
            max_amount: 150000.0,
            daily_limit: 300000.0,
            monthly_limit: 1000000.0,
            currency: "KES".to_string(),
        })
    }

    fn get_provider_name(&self) -> &'static str {
        "MPesa"
    }

    fn get_supported_currencies(&self) -> Vec<&'static str> {
        vec!["KES"]
    }
}

/// Airtel Money provider for Tanzania
#[derive(Debug)]
pub struct AirtelMoneyProvider {
    client_id: String,
    client_secret: String,
    environment: String,
}

impl AirtelMoneyProvider {
    pub fn new() -> Self {
        Self {
            client_id: std::env::var("AIRTEL_CLIENT_ID").unwrap_or_else(|_| "test_client_id".to_string()),
            client_secret: std::env::var("AIRTEL_CLIENT_SECRET").unwrap_or_else(|_| "test_client_secret".to_string()),
            environment: std::env::var("AIRTEL_ENVIRONMENT").unwrap_or_else(|_| "sandbox".to_string()),
        }
    }
}

#[async_trait::async_trait]
impl FiatProvider for AirtelMoneyProvider {
    async fn initiate_payment(&self, amount: f64, phone: &str, reference: &str) -> Result<PaymentResponse> {
        info!("Initiating Airtel Money payment: {} TZS to {}", amount, phone);
        
        // Mock implementation - would integrate with Airtel Money API
        Ok(PaymentResponse {
            success: true,
            transaction_id: Some(format!("airtel_{}", uuid::Uuid::new_v4())),
            message: "Payment initiated successfully".to_string(),
            error_code: None,
            requires_otp: true,
            otp_message: Some("Please check your phone and enter the Airtel Money PIN".to_string()),
        })
    }

    async fn verify_payment(&self, transaction_id: &str) -> Result<PaymentStatus> {
        Ok(PaymentStatus {
            transaction_id: transaction_id.to_string(),
            status: PaymentState::Completed,
            amount: 0.0,
            phone: "".to_string(),
            reference: "".to_string(),
            timestamp: chrono::Utc::now().timestamp() as u64,
            error_message: None,
        })
    }

    async fn get_limits(&self) -> Result<PaymentLimits> {
        Ok(PaymentLimits {
            min_amount: 1.0,
            max_amount: 500000.0,
            daily_limit: 1000000.0,
            monthly_limit: 5000000.0,
            currency: "TZS".to_string(),
        })
    }

    fn get_provider_name(&self) -> &'static str {
        "Airtel Money"
    }

    fn get_supported_currencies(&self) -> Vec<&'static str> {
        vec!["TZS"]
    }
}

/// MTN Mobile Money provider for Uganda, Nigeria, Ghana, etc.
#[derive(Debug)]
pub struct MTNProvider {
    subscription_key: String,
    environment: String,
    country: String,
}

impl MTNProvider {
    pub fn new() -> Self {
        Self {
            subscription_key: std::env::var("MTN_SUBSCRIPTION_KEY").unwrap_or_else(|_| "test_subscription_key".to_string()),
            environment: std::env::var("MTN_ENVIRONMENT").unwrap_or_else(|_| "sandbox".to_string()),
            country: std::env::var("MTN_COUNTRY").unwrap_or_else(|_| "UG".to_string()),
        }
    }
}

#[async_trait::async_trait]
impl FiatProvider for MTNProvider {
    async fn initiate_payment(&self, amount: f64, phone: &str, reference: &str) -> Result<PaymentResponse> {
        info!("Initiating MTN Mobile Money payment: {} to {}", amount, phone);
        
        // Mock implementation - would integrate with MTN Mobile Money API
        Ok(PaymentResponse {
            success: true,
            transaction_id: Some(format!("mtn_{}", uuid::Uuid::new_v4())),
            message: "Payment initiated successfully".to_string(),
            error_code: None,
            requires_otp: true,
            otp_message: Some("Please check your phone and enter the MTN Mobile Money PIN".to_string()),
        })
    }

    async fn verify_payment(&self, transaction_id: &str) -> Result<PaymentStatus> {
        Ok(PaymentStatus {
            transaction_id: transaction_id.to_string(),
            status: PaymentState::Completed,
            amount: 0.0,
            phone: "".to_string(),
            reference: "".to_string(),
            timestamp: chrono::Utc::now().timestamp() as u64,
            error_message: None,
        })
    }

    async fn get_limits(&self) -> Result<PaymentLimits> {
        let (currency, max_amount, daily_limit, monthly_limit) = match self.country.as_str() {
            "UG" => ("UGX", 1000000.0, 2000000.0, 10000000.0),
            "NG" => ("NGN", 500000.0, 1000000.0, 5000000.0),
            "GH" => ("GHS", 10000.0, 20000.0, 100000.0),
            _ => ("USD", 1000.0, 2000.0, 10000.0),
        };

        Ok(PaymentLimits {
            min_amount: 1.0,
            max_amount,
            daily_limit,
            monthly_limit,
            currency: currency.to_string(),
        })
    }

    fn get_provider_name(&self) -> &'static str {
        "MTN Mobile Money"
    }

    fn get_supported_currencies(&self) -> Vec<&'static str> {
        match self.country.as_str() {
            "UG" => vec!["UGX"],
            "NG" => vec!["NGN"],
            "GH" => vec!["GHS"],
            _ => vec!["USD"],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mpesa_provider_creation() {
        let provider = MpesaProvider::new();
        assert_eq!(provider.get_provider_name(), "MPesa");
        assert_eq!(provider.get_supported_currencies(), vec!["KES"]);
    }

    #[tokio::test]
    async fn test_airtel_money_provider() {
        let provider = AirtelMoneyProvider::new();
        assert_eq!(provider.get_provider_name(), "Airtel Money");
        assert_eq!(provider.get_supported_currencies(), vec!["TZS"]);
    }

    #[tokio::test]
    async fn test_mtn_provider() {
        let provider = MTNProvider::new();
        assert_eq!(provider.get_provider_name(), "MTN Mobile Money");
    }
}
