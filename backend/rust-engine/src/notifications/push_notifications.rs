use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, instrument, warn};

/// Push notification service for real-time payment updates
#[derive(Debug)]
pub struct PushNotificationService {
    notification_channels: Arc<RwLock<HashMap<String, NotificationChannel>>>,
    fcm_config: FCMConfig,
    apns_config: APNSConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationChannel {
    pub user_id: String,
    pub device_token: String,
    pub platform: Platform,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub last_used: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Platform {
    Android,
    iOS,
    Web,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NotificationType {
    PaymentReceived,
    PaymentSent,
    PaymentFailed,
    ChannelOpened,
    ChannelClosed,
    ExchangeRateUpdate,
    SystemAlert,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPayload {
    pub title: String,
    pub body: String,
    pub data: HashMap<String, String>,
    pub notification_type: NotificationType,
    pub priority: NotificationPriority,
    pub sound: Option<String>,
    pub badge: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NotificationPriority {
    Low,
    Normal,
    High,
    Critical,
}

#[derive(Debug, Clone)]
pub struct FCMConfig {
    pub server_key: String,
    pub project_id: String,
    pub base_url: String,
}

#[derive(Debug, Clone)]
pub struct APNSConfig {
    pub key_id: String,
    pub team_id: String,
    pub bundle_id: String,
    pub private_key: String,
    pub base_url: String,
}

impl PushNotificationService {
    /// Create a new push notification service
    pub fn new() -> Self {
        Self {
            notification_channels: Arc::new(RwLock::new(HashMap::new())),
            fcm_config: FCMConfig {
                server_key: std::env::var("FCM_SERVER_KEY")
                    .unwrap_or_else(|_| "test_key".to_string()),
                project_id: std::env::var("FCM_PROJECT_ID")
                    .unwrap_or_else(|_| "test_project".to_string()),
                base_url: "https://fcm.googleapis.com/v1/projects".to_string(),
            },
            apns_config: APNSConfig {
                key_id: std::env::var("APNS_KEY_ID").unwrap_or_else(|_| "test_key_id".to_string()),
                team_id: std::env::var("APNS_TEAM_ID")
                    .unwrap_or_else(|_| "test_team_id".to_string()),
                bundle_id: std::env::var("APNS_BUNDLE_ID")
                    .unwrap_or_else(|_| "com.satsconnect.app".to_string()),
                private_key: std::env::var("APNS_PRIVATE_KEY")
                    .unwrap_or_else(|_| "test_key".to_string()),
                base_url: "https://api.push.apple.com".to_string(),
            },
        }
    }

    /// Register a device for push notifications
    #[instrument(skip(self))]
    pub async fn register_device(
        &self,
        user_id: String,
        device_token: String,
        platform: Platform,
    ) -> Result<()> {
        let channel = NotificationChannel {
            user_id: user_id.clone(),
            device_token: device_token.clone(),
            platform,
            is_active: true,
            created_at: Utc::now(),
            last_used: Some(Utc::now()),
        };

        let mut channels = self.notification_channels.write().await;
        channels.insert(device_token, channel);

        info!(
            "Registered device for user: {} on platform: {:?}",
            user_id, platform
        );
        Ok(())
    }

    /// Unregister a device
    #[instrument(skip(self))]
    pub async fn unregister_device(&self, device_token: &str) -> Result<()> {
        let mut channels = self.notification_channels.write().await;
        channels.remove(device_token);
        info!("Unregistered device: {}", device_token);
        Ok(())
    }

    /// Send push notification to a specific user
    #[instrument(skip(self))]
    pub async fn send_to_user(&self, user_id: &str, payload: NotificationPayload) -> Result<()> {
        let channels = self.notification_channels.read().await;
        let user_channels: Vec<&NotificationChannel> = channels
            .values()
            .filter(|channel| channel.user_id == user_id && channel.is_active)
            .collect();

        if user_channels.is_empty() {
            warn!(
                "No active notification channels found for user: {}",
                user_id
            );
            return Ok(());
        }

        for channel in user_channels {
            if let Err(e) = self
                .send_to_device(&channel.device_token, &payload, &channel.platform)
                .await
            {
                error!(
                    "Failed to send notification to device {}: {}",
                    channel.device_token, e
                );
            }
        }

        info!(
            "Sent notification to {} devices for user: {}",
            user_channels.len(),
            user_id
        );
        Ok(())
    }

    /// Send push notification to a specific device
    async fn send_to_device(
        &self,
        device_token: &str,
        payload: &NotificationPayload,
        platform: &Platform,
    ) -> Result<()> {
        match platform {
            Platform::Android => self.send_fcm_notification(device_token, payload).await,
            Platform::iOS => self.send_apns_notification(device_token, payload).await,
            Platform::Web => self.send_web_notification(device_token, payload).await,
        }
    }

    /// Send FCM notification for Android
    async fn send_fcm_notification(
        &self,
        device_token: &str,
        payload: &NotificationPayload,
    ) -> Result<()> {
        let fcm_payload = serde_json::json!({
            "message": {
                "token": device_token,
                "notification": {
                    "title": payload.title,
                    "body": payload.body
                },
                "data": payload.data,
                "android": {
                    "priority": self.map_priority_to_fcm(&payload.priority),
                    "sound": payload.sound.as_deref().unwrap_or("default"),
                    "notification": {
                        "sound": payload.sound.as_deref().unwrap_or("default"),
                        "badge": payload.badge
                    }
                }
            }
        });

        let client = reqwest::Client::new();
        let url = format!(
            "{}/{}/messages:send",
            self.fcm_config.base_url, self.fcm_config.project_id
        );

        let response = client
            .post(&url)
            .header(
                "Authorization",
                format!("Bearer {}", self.fcm_config.server_key),
            )
            .header("Content-Type", "application/json")
            .json(&fcm_payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("FCM error: {}", error_text));
        }

        info!("FCM notification sent to: {}", device_token);
        Ok(())
    }

    /// Send APNS notification for iOS
    async fn send_apns_notification(
        &self,
        device_token: &str,
        payload: &NotificationPayload,
    ) -> Result<()> {
        let apns_payload = serde_json::json!({
            "aps": {
                "alert": {
                    "title": payload.title,
                    "body": payload.body
                },
                "sound": payload.sound.as_deref().unwrap_or("default"),
                "badge": payload.badge,
                "priority": self.map_priority_to_apns(&payload.priority)
            },
            "data": payload.data
        });

        let client = reqwest::Client::new();
        let url = format!("{}/3/device/{}", self.apns_config.base_url, device_token);

        let response = client
            .post(&url)
            .header("apns-topic", &self.apns_config.bundle_id)
            .header("apns-priority", "10")
            .header("apns-expiration", "0")
            .json(&apns_payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("APNS error: {}", error_text));
        }

        info!("APNS notification sent to: {}", device_token);
        Ok(())
    }

    /// Send web notification
    async fn send_web_notification(
        &self,
        device_token: &str,
        payload: &NotificationPayload,
    ) -> Result<()> {
        // Web notifications are typically handled by the frontend
        // This would integrate with Web Push API or similar
        info!(
            "Web notification sent to: {} - {}",
            device_token, payload.title
        );
        Ok(())
    }

    /// Map priority to FCM priority
    fn map_priority_to_fcm(&self, priority: &NotificationPriority) -> &'static str {
        match priority {
            NotificationPriority::Low => "normal",
            NotificationPriority::Normal => "normal",
            NotificationPriority::High => "high",
            NotificationPriority::Critical => "high",
        }
    }

    /// Map priority to APNS priority
    fn map_priority_to_apns(&self, priority: &NotificationPriority) -> u8 {
        match priority {
            NotificationPriority::Low => 5,
            NotificationPriority::Normal => 5,
            NotificationPriority::High => 10,
            NotificationPriority::Critical => 10,
        }
    }

    /// Create payment received notification
    pub fn create_payment_received_notification(
        &self,
        amount_sats: u64,
        from_address: &str,
        tx_hash: &str,
    ) -> NotificationPayload {
        NotificationPayload {
            title: "Payment Received! 🎉".to_string(),
            body: format!(
                "You received {} sats from {}",
                amount_sats,
                &from_address[..8]
            ),
            data: {
                let mut data = HashMap::new();
                data.insert("type".to_string(), "payment_received".to_string());
                data.insert("amount_sats".to_string(), amount_sats.to_string());
                data.insert("from_address".to_string(), from_address.to_string());
                data.insert("tx_hash".to_string(), tx_hash.to_string());
                data
            },
            notification_type: NotificationType::PaymentReceived,
            priority: NotificationPriority::High,
            sound: Some("payment_received.wav".to_string()),
            badge: Some(1),
        }
    }

    /// Create payment sent notification
    pub fn create_payment_sent_notification(
        &self,
        amount_sats: u64,
        to_address: &str,
        tx_hash: &str,
    ) -> NotificationPayload {
        NotificationPayload {
            title: "Payment Sent ✅".to_string(),
            body: format!("You sent {} sats to {}", amount_sats, &to_address[..8]),
            data: {
                let mut data = HashMap::new();
                data.insert("type".to_string(), "payment_sent".to_string());
                data.insert("amount_sats".to_string(), amount_sats.to_string());
                data.insert("to_address".to_string(), to_address.to_string());
                data.insert("tx_hash".to_string(), tx_hash.to_string());
                data
            },
            notification_type: NotificationType::PaymentSent,
            priority: NotificationPriority::Normal,
            sound: Some("payment_sent.wav".to_string()),
            badge: None,
        }
    }

    /// Create payment failed notification
    pub fn create_payment_failed_notification(
        &self,
        amount_sats: u64,
        error_message: &str,
    ) -> NotificationPayload {
        NotificationPayload {
            title: "Payment Failed ❌".to_string(),
            body: format!("Payment of {} sats failed: {}", amount_sats, error_message),
            data: {
                let mut data = HashMap::new();
                data.insert("type".to_string(), "payment_failed".to_string());
                data.insert("amount_sats".to_string(), amount_sats.to_string());
                data.insert("error".to_string(), error_message.to_string());
                data
            },
            notification_type: NotificationType::PaymentFailed,
            priority: NotificationPriority::High,
            sound: Some("payment_failed.wav".to_string()),
            badge: Some(1),
        }
    }

    /// Get notification statistics
    pub async fn get_notification_stats(&self) -> Result<NotificationStats> {
        let channels = self.notification_channels.read().await;

        let total_devices = channels.len();
        let active_devices = channels.values().filter(|c| c.is_active).count();

        let mut devices_by_platform = HashMap::new();
        for channel in channels.values() {
            *devices_by_platform
                .entry(channel.platform.clone())
                .or_insert(0) += 1;
        }

        Ok(NotificationStats {
            total_devices,
            active_devices,
            devices_by_platform,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationStats {
    pub total_devices: usize,
    pub active_devices: usize,
    pub devices_by_platform: HashMap<Platform, usize>,
}

impl Default for PushNotificationService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_push_notification_service() {
        let service = PushNotificationService::new();

        service
            .register_device(
                "user123".to_string(),
                "device_token_123".to_string(),
                Platform::Android,
            )
            .await
            .unwrap();

        let stats = service.get_notification_stats().await.unwrap();
        assert_eq!(stats.total_devices, 1);
        assert_eq!(stats.active_devices, 1);
    }

    #[test]
    fn test_notification_payload_creation() {
        let service = PushNotificationService::new();
        let payload =
            service.create_payment_received_notification(1000, "test_address", "test_hash");

        assert_eq!(payload.title, "Payment Received! 🎉");
        assert_eq!(payload.notification_type, NotificationType::PaymentReceived);
        assert_eq!(payload.priority, NotificationPriority::High);
    }
}
