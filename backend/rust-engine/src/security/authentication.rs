use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tracing::{info, error, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthToken {
    pub token: String,
    pub user_id: String,
    pub expires_at: SystemTime,
    pub permissions: Vec<String>,
    pub created_at: SystemTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthResult {
    Success(AuthToken),
    InvalidCredentials,
    TokenExpired,
    InsufficientPermissions,
    AccountLocked,
    RateLimited,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub user_id: String,
    pub email: String,
    pub password_hash: String,
    pub permissions: Vec<String>,
    pub is_active: bool,
    pub created_at: SystemTime,
    pub last_login: Option<SystemTime>,
    pub failed_login_attempts: u32,
    pub locked_until: Option<SystemTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub token_expiry_duration: Duration,
    pub max_failed_attempts: u32,
    pub lockout_duration: Duration,
    pub rate_limit_requests: u32,
    pub rate_limit_window: Duration,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            jwt_secret: "default_secret_key".to_string(),
            token_expiry_duration: Duration::from_secs(3600), // 1 hour
            max_failed_attempts: 5,
            lockout_duration: Duration::from_secs(900), // 15 minutes
            rate_limit_requests: 100,
            rate_limit_window: Duration::from_secs(3600), // 1 hour
        }
    }
}

/// Authentication service for managing user authentication
#[derive(Debug)]
pub struct AuthenticationService {
    config: AuthConfig,
    users: HashMap<String, User>,
    active_tokens: HashMap<String, AuthToken>,
    rate_limits: HashMap<String, (u32, SystemTime)>,
}

impl AuthenticationService {
    pub fn new(config: AuthConfig) -> Self {
        Self {
            config,
            users: HashMap::new(),
            active_tokens: HashMap::new(),
            rate_limits: HashMap::new(),
        }
    }

    pub async fn register_user(
        &mut self,
        email: String,
        password: String,
        permissions: Vec<String>,
    ) -> Result<String> {
        // Check if user already exists
        if self.users.contains_key(&email) {
            return Err(anyhow::anyhow!("User already exists"));
        }

        // Hash password (in real implementation, use proper password hashing)
        let password_hash = self.hash_password(&password)?;

        let user_id = uuid::Uuid::new_v4().to_string();
        let user = User {
            user_id: user_id.clone(),
            email: email.clone(),
            password_hash,
            permissions,
            is_active: true,
            created_at: SystemTime::now(),
            last_login: None,
            failed_login_attempts: 0,
            locked_until: None,
        };

        self.users.insert(email, user);
        info!("User registered with ID: {}", user_id);
        Ok(user_id)
    }

    pub async fn authenticate_user(
        &mut self,
        email: String,
        password: String,
    ) -> Result<AuthResult> {
        // Check rate limiting
        if self.is_rate_limited(&email).await {
            return Ok(AuthResult::RateLimited);
        }

        // Get user
        let user = match self.users.get_mut(&email) {
            Some(user) => user,
            None => return Ok(AuthResult::InvalidCredentials),
        };

        // Check if account is locked
        if let Some(locked_until) = user.locked_until {
            if SystemTime::now() < locked_until {
                return Ok(AuthResult::AccountLocked);
            } else {
                // Unlock account
                user.locked_until = None;
                user.failed_login_attempts = 0;
            }
        }

        // Check if account is active
        if !user.is_active {
            return Ok(AuthResult::InvalidCredentials);
        }

        // Verify password
        if !self.verify_password(&password, &user.password_hash)? {
            user.failed_login_attempts += 1;
            
            // Lock account if too many failed attempts
            if user.failed_login_attempts >= self.config.max_failed_attempts {
                user.locked_until = Some(SystemTime::now() + self.config.lockout_duration);
                warn!("Account locked for user: {}", email);
            }
            
            return Ok(AuthResult::InvalidCredentials);
        }

        // Reset failed attempts and update last login
        user.failed_login_attempts = 0;
        user.last_login = Some(SystemTime::now());

        // Generate token
        let token = self.generate_token(&user.user_id, &user.permissions)?;
        
        // Store active token
        self.active_tokens.insert(token.token.clone(), token.clone());

        // Update rate limiting
        self.update_rate_limit(&email).await;

        info!("User authenticated successfully: {}", email);
        Ok(AuthResult::Success(token))
    }

    pub async fn validate_token(&self, token: &str) -> Result<AuthResult> {
        let auth_token = match self.active_tokens.get(token) {
            Some(token) => token,
            None => return Ok(AuthResult::InvalidCredentials),
        };

        // Check if token is expired
        if SystemTime::now() > auth_token.expires_at {
            return Ok(AuthResult::TokenExpired);
        }

        Ok(AuthResult::Success(auth_token.clone()))
    }

    pub async fn revoke_token(&mut self, token: &str) -> Result<()> {
        if self.active_tokens.remove(token).is_some() {
            info!("Token revoked: {}", token);
        }
        Ok(())
    }

    pub async fn check_permission(&self, token: &str, permission: &str) -> Result<bool> {
        let auth_token = match self.active_tokens.get(token) {
            Some(token) => token,
            None => return Ok(false),
        };

        Ok(auth_token.permissions.contains(&permission.to_string()))
    }

    pub async fn logout_user(&mut self, token: &str) -> Result<()> {
        self.revoke_token(token).await
    }

    fn hash_password(&self, password: &str) -> Result<String> {
        // In a real implementation, use Argon2 or bcrypt
        // For now, just return a simple hash
        Ok(format!("hash_{}", password))
    }

    fn verify_password(&self, password: &str, hash: &str) -> Result<bool> {
        // In a real implementation, use proper password verification
        Ok(hash == &format!("hash_{}", password))
    }

    fn generate_token(&self, user_id: &str, permissions: &[String]) -> Result<AuthToken> {
        let token = format!("token_{}_{}", user_id, uuid::Uuid::new_v4());
        let expires_at = SystemTime::now() + self.config.token_expiry_duration;
        
        Ok(AuthToken {
            token,
            user_id: user_id.to_string(),
            expires_at,
            permissions: permissions.to_vec(),
            created_at: SystemTime::now(),
        })
    }

    async fn is_rate_limited(&self, email: &str) -> bool {
        if let Some((count, window_start)) = self.rate_limits.get(email) {
            let now = SystemTime::now();
            if now.duration_since(*window_start).unwrap_or_default() < self.config.rate_limit_window {
                *count >= self.config.rate_limit_requests
            } else {
                false
            }
        } else {
            false
        }
    }

    async fn update_rate_limit(&mut self, email: &str) {
        let now = SystemTime::now();
        if let Some((count, window_start)) = self.rate_limits.get_mut(email) {
            if now.duration_since(*window_start).unwrap_or_default() < self.config.rate_limit_window {
                *count += 1;
            } else {
                *count = 1;
                *window_start = now;
            }
        } else {
            self.rate_limits.insert(email.to_string(), (1, now));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_user_registration() {
        let config = AuthConfig::default();
        let mut auth_service = AuthenticationService::new(config);
        
        let result = auth_service.register_user(
            "test@example.com".to_string(),
            "password123".to_string(),
            vec!["read".to_string(), "write".to_string()],
        ).await;
        
        assert!(result.is_ok());
        let user_id = result.unwrap();
        assert!(!user_id.is_empty());
    }

    #[tokio::test]
    async fn test_user_authentication() {
        let config = AuthConfig::default();
        let mut auth_service = AuthenticationService::new(config);
        
        // Register user
        auth_service.register_user(
            "test@example.com".to_string(),
            "password123".to_string(),
            vec!["read".to_string()],
        ).await.unwrap();
        
        // Authenticate user
        let result = auth_service.authenticate_user(
            "test@example.com".to_string(),
            "password123".to_string(),
        ).await;
        
        assert!(result.is_ok());
        match result.unwrap() {
            AuthResult::Success(token) => {
                assert!(!token.token.is_empty());
                assert_eq!(token.user_id, "test@example.com");
            }
            _ => panic!("Authentication should have succeeded"),
        }
    }

    #[tokio::test]
    async fn test_invalid_credentials() {
        let config = AuthConfig::default();
        let mut auth_service = AuthenticationService::new(config);
        
        // Register user
        auth_service.register_user(
            "test@example.com".to_string(),
            "password123".to_string(),
            vec!["read".to_string()],
        ).await.unwrap();
        
        // Try to authenticate with wrong password
        let result = auth_service.authenticate_user(
            "test@example.com".to_string(),
            "wrongpassword".to_string(),
        ).await;
        
        assert!(result.is_ok());
        match result.unwrap() {
            AuthResult::InvalidCredentials => {}
            _ => panic!("Should have failed with invalid credentials"),
        }
    }
}
