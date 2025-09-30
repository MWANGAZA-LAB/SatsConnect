import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Vibration,
} from 'react-native';
import { Card } from './Card';
import { Button } from './Button';
import { theme } from '../theme';
import { secureStorage } from '../services/secureStorage';
import * as Crypto from 'expo-crypto';

const { width } = Dimensions.get('window');

export interface PINEntryProps {
  onSuccess: () => void;
  onCancel: () => void;
  visible: boolean;
  isSetup?: boolean;
  onSetupComplete?: (pin: string) => void;
}

export const PINEntry: React.FC<PINEntryProps> = ({
  onSuccess,
  onCancel,
  visible,
  isSetup = false,
  onSetupComplete,
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      resetState();
      startAnimation();
    }
  }, [visible]);

  const resetState = () => {
    setPin('');
    setConfirmPin('');
    setIsConfirming(false);
    setError(null);
    setAttempts(0);
    setIsLocked(false);
    setLockoutTime(0);
  };

  const startAnimation = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const shakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleNumberPress = (number: string) => {
    if (isLocked) return;

    const newPin = pin + number;
    setPin(newPin);
    setError(null);

    if (isSetup) {
      if (newPin.length === 6) {
        if (!isConfirming) {
          setIsConfirming(true);
          setPin('');
        } else {
          setConfirmPin(newPin);
        }
      }
    } else {
      if (newPin.length === 6) {
        verifyPIN(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (isLocked) return;

    if (isConfirming && confirmPin.length > 0) {
      setConfirmPin(confirmPin.slice(0, -1));
    } else if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  const verifyPIN = async (pinToVerify: string) => {
    try {
      const storedPinHash = await secureStorage.getStoredPinHash();
      const storedSalt = await secureStorage.getPinSalt();

      if (!storedPinHash || !storedSalt) {
        setError('No PIN set. Please set up a PIN first.');
        return;
      }

      const hashedPin = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        pinToVerify + storedSalt,
        { encoding: Crypto.CryptoEncoding.HEX }
      );

      if (hashedPin === storedPinHash) {
        setAttempts(0);
        onSuccess();
      } else {
        handleAuthFailure();
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      setError('PIN verification failed. Please try again.');
      handleAuthFailure();
    }
  };

  const handleSetupComplete = async () => {
    if (pin !== confirmPin) {
      setError('PINs do not match. Please try again.');
      setPin('');
      setConfirmPin('');
      setIsConfirming(false);
      shakeAnimation();
      return;
    }

    try {
      const salt = await Crypto.getRandomBytesAsync(16).then(bytes => 
        btoa(String.fromCharCode(...bytes))
      );
      
      const hashedPin = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        pin + salt,
        { encoding: Crypto.CryptoEncoding.HEX }
      );

      await secureStorage.savePinHash(hashedPin);
      await secureStorage.savePinSalt(salt);

      onSetupComplete?.(pin);
      onSuccess();
    } catch (error) {
      console.error('PIN setup error:', error);
      setError('Failed to save PIN. Please try again.');
    }
  };

  const handleAuthFailure = () => {
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    setPin('');
    setConfirmPin('');
    setIsConfirming(false);

    Vibration.vibrate(200);
    shakeAnimation();

    if (newAttempts >= 3) {
      setIsLocked(true);
      setLockoutTime(Date.now() + 60000); // 1 minute lockout
      
      setTimeout(() => {
        setIsLocked(false);
        setAttempts(0);
        setLockoutTime(0);
      }, 60000);
    } else {
      setError(`Incorrect PIN. ${3 - newAttempts} attempts remaining.`);
    }
  };

  const getRemainingLockoutTime = () => {
    const remaining = Math.max(0, lockoutTime - Date.now());
    return Math.ceil(remaining / 1000);
  };

  const getDisplayPin = () => {
    if (isSetup && isConfirming) {
      return confirmPin;
    }
    return pin;
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateX: shakeAnim }],
          },
        ]}
      >
        <Card style={styles.pinCard}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {isSetup ? 'Set Up PIN' : 'Enter PIN'}
            </Text>
            <Text style={styles.subtitle}>
              {isLocked
                ? `Too many failed attempts. Try again in ${getRemainingLockoutTime()}s`
                : isSetup
                  ? isConfirming
                    ? 'Confirm your PIN'
                    : 'Create a 6-digit PIN'
                  : 'Enter your 6-digit PIN'
              }
            </Text>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.pinDisplay}>
            {Array.from({ length: 6 }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.pinDot,
                  index < getDisplayPin().length && styles.pinDotFilled,
                ]}
              />
            ))}
          </View>

          <View style={styles.keypad}>
            {Array.from({ length: 9 }, (_, index) => (
              <TouchableOpacity
                key={index + 1}
                style={styles.keypadButton}
                onPress={() => handleNumberPress((index + 1).toString())}
                disabled={isLocked || getDisplayPin().length >= 6}
              >
                <Text style={styles.keypadText}>{index + 1}</Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={styles.keypadButton}
              onPress={onCancel}
              disabled={isLocked}
            >
              <Text style={styles.keypadText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.keypadButton}
              onPress={() => handleNumberPress('0')}
              disabled={isLocked || getDisplayPin().length >= 6}
            >
              <Text style={styles.keypadText}>0</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.keypadButton}
              onPress={handleBackspace}
              disabled={isLocked || getDisplayPin().length === 0}
            >
              <Text style={styles.keypadText}>⌫</Text>
            </TouchableOpacity>
          </View>

          {isSetup && isConfirming && getDisplayPin().length === 6 && (
            <Button
              title="Complete Setup"
              onPress={handleSetupComplete}
              style={styles.completeButton}
            />
          )}
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
  pinCard: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
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
    marginBottom: theme.spacing.lg,
    width: '100%',
  },
  errorText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.error,
    textAlign: 'center',
  },
  pinDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.gray300,
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  keypadButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: theme.colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    margin: theme.spacing.xs,
  },
  keypadText: {
    ...theme.typography.textStyles.h5,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  completeButton: {
    marginTop: theme.spacing.md,
    minWidth: 200,
  },
});
