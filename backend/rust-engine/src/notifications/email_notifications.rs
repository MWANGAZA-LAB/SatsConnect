use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailNotification {
    pub to: String,
    pub subject: String,
    pub body: String,
    pub template: Option<EmailTemplate>,
    pub variables: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EmailTemplate {
    Welcome,
    PaymentReceived,
    PaymentSent,
    InvoiceGenerated,
    SecurityAlert,
    AccountUpdate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailConfig {
    pub smtp_host: String,
    pub smtp_port: u16,
    pub username: String,
    pub password: String,
    pub from_email: String,
    pub from_name: String,
}

/// Email notification service
#[derive(Debug)]
pub struct EmailNotificationService {
    config: EmailConfig,
}

impl EmailNotificationService {
    pub fn new(config: EmailConfig) -> Self {
        Self { config }
    }

    pub async fn send_notification(&self, notification: EmailNotification) -> Result<()> {
        info!("Sending email notification to: {}", notification.to);

        // In a real implementation, this would use an email service like SendGrid, SES, etc.
        // For now, we'll just log the notification
        info!(
            "Email sent - To: {}, Subject: {}, Body: {}",
            notification.to, notification.subject, notification.body
        );

        Ok(())
    }

    pub async fn send_template_notification(
        &self,
        to: String,
        template: EmailTemplate,
        variables: HashMap<String, String>,
    ) -> Result<()> {
        let (subject, body) = self.render_template(&template, &variables);

        let notification = EmailNotification {
            to,
            subject,
            body,
            template: Some(template),
            variables,
        };

        self.send_notification(notification).await
    }

    fn render_template(
        &self,
        template: &EmailTemplate,
        variables: &HashMap<String, String>,
    ) -> (String, String) {
        match template {
            EmailTemplate::Welcome => {
                let name = variables.get("name").unwrap_or(&"User".to_string());
                let subject = "Welcome to SatsConnect!".to_string();
                let body = format!(
                    "Hello {},\n\nWelcome to SatsConnect! Your Bitcoin Lightning wallet is ready to use.\n\nBest regards,\nThe SatsConnect Team",
                    name
                );
                (subject, body)
            }
            EmailTemplate::PaymentReceived => {
                let amount = variables.get("amount").unwrap_or(&"0".to_string());
                let subject = "Payment Received".to_string();
                let body = format!(
                    "You have received {} sats in your SatsConnect wallet.\n\nBest regards,\nThe SatsConnect Team",
                    amount
                );
                (subject, body)
            }
            EmailTemplate::PaymentSent => {
                let amount = variables.get("amount").unwrap_or(&"0".to_string());
                let subject = "Payment Sent".to_string();
                let body = format!(
                    "You have sent {} sats from your SatsConnect wallet.\n\nBest regards,\nThe SatsConnect Team",
                    amount
                );
                (subject, body)
            }
            EmailTemplate::InvoiceGenerated => {
                let amount = variables.get("amount").unwrap_or(&"0".to_string());
                let subject = "Invoice Generated".to_string();
                let body = format!(
                    "An invoice for {} sats has been generated in your SatsConnect wallet.\n\nBest regards,\nThe SatsConnect Team",
                    amount
                );
                (subject, body)
            }
            EmailTemplate::SecurityAlert => {
                let subject = "Security Alert".to_string();
                let body = "A security event has been detected on your SatsConnect account. Please review your account activity.\n\nBest regards,\nThe SatsConnect Team".to_string();
                (subject, body)
            }
            EmailTemplate::AccountUpdate => {
                let subject = "Account Updated".to_string();
                let body = "Your SatsConnect account has been updated successfully.\n\nBest regards,\nThe SatsConnect Team".to_string();
                (subject, body)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_send_notification() {
        let config = EmailConfig {
            smtp_host: "localhost".to_string(),
            smtp_port: 587,
            username: "test".to_string(),
            password: "test".to_string(),
            from_email: "noreply@satsconnect.com".to_string(),
            from_name: "SatsConnect".to_string(),
        };

        let service = EmailNotificationService::new(config);

        let notification = EmailNotification {
            to: "test@example.com".to_string(),
            subject: "Test Subject".to_string(),
            body: "Test Body".to_string(),
            template: None,
            variables: HashMap::new(),
        };

        let result = service.send_notification(notification).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_template_notification() {
        let config = EmailConfig {
            smtp_host: "localhost".to_string(),
            smtp_port: 587,
            username: "test".to_string(),
            password: "test".to_string(),
            from_email: "noreply@satsconnect.com".to_string(),
            from_name: "SatsConnect".to_string(),
        };

        let service = EmailNotificationService::new(config);

        let mut variables = HashMap::new();
        variables.insert("name".to_string(), "John Doe".to_string());

        let result = service
            .send_template_notification(
                "test@example.com".to_string(),
                EmailTemplate::Welcome,
                variables,
            )
            .await;

        assert!(result.is_ok());
    }
}
