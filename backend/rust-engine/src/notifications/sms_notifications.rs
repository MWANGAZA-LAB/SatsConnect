use anyhow::Result;
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmsNotification {
    pub to: String,
    pub message: String,
    pub provider: SmsProvider,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SmsProvider {
    Twilio,
    AWS_SNS,
    Vonage,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmsConfig {
    pub provider: SmsProvider,
    pub api_key: String,
    pub api_secret: String,
    pub from_number: String,
}

/// SMS notification service
#[derive(Debug)]
pub struct SmsNotificationService {
    config: SmsConfig,
}

impl SmsNotificationService {
    pub fn new(config: SmsConfig) -> Self {
        Self { config }
    }

    pub async fn send_notification(&self, notification: SmsNotification) -> Result<()> {
        info!("Sending SMS notification to: {}", notification.to);

        // In a real implementation, this would use an SMS service like Twilio, AWS SNS, etc.
        // For now, we'll just log the notification
        info!(
            "SMS sent - To: {}, Message: {}, Provider: {:?}",
            notification.to, notification.message, notification.provider
        );

        Ok(())
    }

    pub async fn send_payment_notification(
        &self,
        to: String,
        amount: u64,
        is_received: bool,
    ) -> Result<()> {
        let message = if is_received {
            format!("You received {} sats in your SatsConnect wallet.", amount)
        } else {
            format!("You sent {} sats from your SatsConnect wallet.", amount)
        };

        let notification = SmsNotification {
            to,
            message,
            provider: self.config.provider.clone(),
        };

        self.send_notification(notification).await
    }

    pub async fn send_security_alert(&self, to: String) -> Result<()> {
        let message = "Security alert: Unusual activity detected on your SatsConnect account. Please review immediately.".to_string();

        let notification = SmsNotification {
            to,
            message,
            provider: self.config.provider.clone(),
        };

        self.send_notification(notification).await
    }

    pub async fn send_verification_code(&self, to: String, code: String) -> Result<()> {
        let message = format!(
            "Your SatsConnect verification code is: {}. This code expires in 10 minutes.",
            code
        );

        let notification = SmsNotification {
            to,
            message,
            provider: self.config.provider.clone(),
        };

        self.send_notification(notification).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_send_notification() {
        let config = SmsConfig {
            provider: SmsProvider::Twilio,
            api_key: "test_key".to_string(),
            api_secret: "test_secret".to_string(),
            from_number: "+1234567890".to_string(),
        };

        let service = SmsNotificationService::new(config);

        let notification = SmsNotification {
            to: "+1234567890".to_string(),
            message: "Test SMS message".to_string(),
            provider: SmsProvider::Twilio,
        };

        let result = service.send_notification(notification).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_payment_notification() {
        let config = SmsConfig {
            provider: SmsProvider::Twilio,
            api_key: "test_key".to_string(),
            api_secret: "test_secret".to_string(),
            from_number: "+1234567890".to_string(),
        };

        let service = SmsNotificationService::new(config);

        let result = service
            .send_payment_notification("+1234567890".to_string(), 1000, true)
            .await;

        assert!(result.is_ok());
    }
}
