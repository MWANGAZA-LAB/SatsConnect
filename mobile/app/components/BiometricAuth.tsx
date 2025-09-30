import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Button } from './Button';
import { Card } from './Card';
import { theme } from '../theme';
import { secureStorage } from '../services/secureStorage';

const { width, height } = Dimensions.get('window');

export interface BiometricAuthProps {
  onSuccess: () => void;
  onCancel: () => void;
  visible: boolean;
}

export const BiometricAuth: React.FC<BiometricAuthProps> = ({
  onSuccess,
  onCancel,
  visible,
}) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [biometricType, setBiometricType] = useState<LocalAuthentication.AuthenticationType | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      checkBiometricAvailability();
      startAnimation();
    }
  }, [visible]);

  useEffect(() => {
    if (visible && isAvailable && !isLocked) {
      authenticateWithBiometrics();
    }
  }, [visible, isAvailable, isLocked]);

  const startAnimation = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const checkBiometricAvailability = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      if (hasHardware && isEnrolled && supportedTypes.length > 0) {
        setIsAvailable(true);
        setBiometricType(supportedTypes[0]);
      } else {
        setIsAvailable(false);
      }
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      setIsAvailable(false);
    }
  };

  const authenticateWithBiometrics = async () => {
    if (isAuthenticating || isLocked) return;

    try {
      setIsAuthenticating(true);
      setError(null);

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access SatsConnect',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setAttempts(0);
        onSuccess();
      } else {
        handleAuthFailure();
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      setError('Authentication failed. Please try again.');
      handleAuthFailure();
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleAuthFailure = () => {
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (newAttempts >= 3) {
      setIsLocked(true);
      setLockoutTime(Date.now() + 30000); // 30 second lockout
      
      setTimeout(() => {
        setIsLocked(false);
        setAttempts(0);
        setLockoutTime(0);
      }, 30000);
    }
  };

  const getBiometricIcon = () => {
    switch (biometricType) {
      case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
        return '👤';
      case LocalAuthentication.AuthenticationType.FINGERPRINT:
        return '👆';
      case LocalAuthentication.AuthenticationType.IRIS:
        return '👁️';
      default:
        return '🔐';
    }
  };

  const getBiometricName = () => {
    switch (biometricType) {
      case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
        return 'Face ID';
      case LocalAuthentication.AuthenticationType.FINGERPRINT:
        return 'Touch ID';
      case LocalAuthentication.AuthenticationType.IRIS:
        return 'Iris Scan';
      default:
        return 'Biometric';
    }
  };

  const getRemainingLockoutTime = () => {
    const remaining = Math.max(0, lockoutTime - Date.now());
    return Math.ceil(remaining / 1000);
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Card style={styles.authCard}>
          <View style={styles.header}>
            <Text style={styles.icon}>{getBiometricIcon()}</Text>
            <Text style={styles.title}>Secure Access</Text>
            <Text style={styles.subtitle}>
              {isLocked
                ? `Too many failed attempts. Try again in ${getRemainingLockoutTime()}s`
                : isAvailable
                  ? `Use ${getBiometricName()} to unlock`
                  : 'Biometric authentication not available'
              }
            </Text>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {attempts > 0 && !isLocked && (
            <View style={styles.attemptsContainer}>
              <Text style={styles.attemptsText}>
                Failed attempts: {attempts}/3
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            {isAvailable && !isLocked && (
              <Button
                title={isAuthenticating ? 'Authenticating...' : `Use ${getBiometricName()}`}
                onPress={authenticateWithBiometrics}
                disabled={isAuthenticating}
                style={styles.biometricButton}
              />
            )}

            <Button
              title="Cancel"
              onPress={onCancel}
              variant="outline"
              style={styles.cancelButton}
            />
          </View>
        </Card>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    width: width * 0.9,
    maxWidth: 400,
  },
  authCard: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  icon: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.textStyles.h3,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.textStyles.body1,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: theme.colors.error + '10',
    borderColor: theme.colors.error,
    borderWidth: 1,
    borderRadius: theme.spacing.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  errorText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.error,
    textAlign: 'center',
  },
  attemptsContainer: {
    backgroundColor: theme.colors.warning + '10',
    borderColor: theme.colors.warning,
    borderWidth: 1,
    borderRadius: theme.spacing.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  attemptsText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.warning,
    textAlign: 'center',
    fontWeight: '600',
  },
  actions: {
    width: '100%',
    gap: theme.spacing.md,
  },
  biometricButton: {
    backgroundColor: theme.colors.primary,
  },
  cancelButton: {
    borderColor: theme.colors.textSecondary,
  },
});
