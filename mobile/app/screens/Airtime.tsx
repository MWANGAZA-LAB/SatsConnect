import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { theme } from '../theme';
import { walletService } from '../services/walletService';

type AirtimeNavigationProp = StackNavigationProp<RootStackParamList, 'Airtime'>;

const AIRTIME_PROVIDERS = [
  { id: 'safaricom', name: 'Safaricom', color: '#00A86B' },
  { id: 'airtel', name: 'Airtel', color: '#E60012' },
  { id: 'telkom', name: 'Telkom', color: '#FF6B35' },
];

const AIRTIME_AMOUNTS = [50, 100, 200, 500, 1000, 2000, 5000];

export default function Airtime() {
  const navigation = useNavigation<AirtimeNavigationProp>();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('safaricom');
  const [customAmount, setCustomAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!/^(\+254|0)[0-9]{9}$/.test(phoneNumber.replace(/\s/g, ''))) {
      newErrors.phoneNumber = 'Invalid Kenyan phone number format';
    }

    if (!amount && !customAmount) {
      newErrors.amount = 'Please select or enter an amount';
    }

    if (customAmount && (isNaN(Number(customAmount)) || Number(customAmount) <= 0)) {
      newErrors.customAmount = 'Amount must be a positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBuyAirtime = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      
      const amountSats = customAmount 
        ? Math.floor(Number(customAmount) * 100000000) // Convert BTC to sats
        : Math.floor(Number(amount) * 100000000);
      
      const success = await walletService.buyAirtime(
        amountSats,
        phoneNumber,
        selectedProvider
      );

      if (success) {
        Alert.alert(
          'Airtime Purchase',
          `Airtime purchase initiated for ${phoneNumber}. You will receive a confirmation once the transaction is complete.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setPhoneNumber('');
                setAmount('');
                setCustomAmount('');
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to purchase airtime. Please try again.');
      }
    } catch (error) {
      console.error('Buy airtime error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (text: string) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, '');
    
    // Format as Kenyan phone number
    if (cleaned.startsWith('254')) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('0')) {
      return `+254${cleaned.substring(1)}`;
    } else if (cleaned.length > 0) {
      return `+254${cleaned}`;
    }
    
    return cleaned;
  };

  const formatAmount = (value: string) => {
    // Remove any non-numeric characters except decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    
    return cleaned;
  };

  const formatSats = (sats: number) => {
    if (sats >= 100000000) {
      return `${(sats / 100000000).toFixed(8)} BTC`;
    } else if (sats >= 1000) {
      return `${(sats / 1000).toFixed(1)}K sats`;
    } else {
      return `${sats} sats`;
    }
  };

  const formatKES = (sats: number) => {
    // Mock conversion rate: 1 BTC = 4,000,000 KES
    const btc = sats / 100000000;
    const kes = btc * 4000000;
    return `≈ ${kes.toFixed(0)} KES`;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner text="Processing airtime purchase..." />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Buy Airtime</Text>
          <Text style={styles.subtitle}>
            Purchase airtime for any Kenyan mobile number
          </Text>
        </View>

        <Card style={styles.formCard}>
          <Input
            label="Phone Number"
            placeholder="+254 700 000 000"
            value={phoneNumber}
            onChangeText={(text) => setPhoneNumber(formatPhoneNumber(text))}
            keyboardType="phone-pad"
            error={errors.phoneNumber}
          />

          <View style={styles.providerSection}>
            <Text style={styles.sectionLabel}>Network Provider</Text>
            <View style={styles.providerGrid}>
              {AIRTIME_PROVIDERS.map((provider) => (
                <TouchableOpacity
                  key={provider.id}
                  style={[
                    styles.providerButton,
                    selectedProvider === provider.id && styles.providerButtonActive,
                  ]}
                  onPress={() => setSelectedProvider(provider.id)}
                >
                  <View
                    style={[
                      styles.providerColor,
                      { backgroundColor: provider.color },
                    ]}
                  />
                  <Text
                    style={[
                      styles.providerText,
                      selectedProvider === provider.id && styles.providerTextActive,
                    ]}
                  >
                    {provider.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.amountSection}>
            <Text style={styles.sectionLabel}>Amount (BTC)</Text>
            
            <View style={styles.amountGrid}>
              {AIRTIME_AMOUNTS.map((amountValue) => (
                <TouchableOpacity
                  key={amountValue}
                  style={[
                    styles.amountButton,
                    amount === amountValue.toString() && styles.amountButtonActive,
                  ]}
                  onPress={() => {
                    setAmount(amountValue.toString());
                    setCustomAmount('');
                  }}
                >
                  <Text
                    style={[
                      styles.amountButtonText,
                      amount === amountValue.toString() && styles.amountButtonTextActive,
                    ]}
                  >
                    {formatSats(amountValue * 100000000)}
                  </Text>
                  <Text
                    style={[
                      styles.amountButtonKES,
                      amount === amountValue.toString() && styles.amountButtonTextActive,
                    ]}
                  >
                    {formatKES(amountValue * 100000000)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Custom Amount (BTC) - Optional"
              placeholder="0.001"
              value={customAmount}
              onChangeText={(text) => {
                setCustomAmount(formatAmount(text));
                setAmount('');
              }}
              keyboardType="numeric"
              error={errors.customAmount}
            />
          </View>
        </Card>

        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Purchase Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Phone Number:</Text>
            <Text style={styles.summaryValue}>{phoneNumber || 'Not specified'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Provider:</Text>
            <Text style={styles.summaryValue}>
              {AIRTIME_PROVIDERS.find(p => p.id === selectedProvider)?.name || 'Not selected'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount:</Text>
            <Text style={styles.summaryValue}>
              {customAmount 
                ? `${formatSats(Number(customAmount) * 100000000)} (${formatKES(Number(customAmount) * 100000000)})`
                : amount 
                  ? `${formatSats(Number(amount) * 100000000)} (${formatKES(Number(amount) * 100000000)})`
                  : 'Not specified'
              }
            </Text>
          </View>
        </Card>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 Airtime Purchase Info</Text>
          <Text style={styles.infoText}>
            • Airtime is usually credited within 1-2 minutes{'\n'}
            • You can purchase airtime for any Kenyan mobile number{'\n'}
            • Minimum purchase amount is 1 sat{'\n'}
            • Maximum purchase amount is 0.1 BTC per transaction{'\n'}
            • All transactions are processed via Lightning Network
          </Text>
        </Card>

        <View style={styles.buttonContainer}>
          <Button
            title="Buy Airtime"
            onPress={handleBuyAirtime}
            disabled={!phoneNumber.trim() || (!amount && !customAmount) || isLoading}
            style={styles.buyButton}
          />
          
          <Button
            title="Cancel"
            onPress={() => navigation.goBack()}
            variant="outline"
            style={styles.cancelButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.screen.padding,
    paddingBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.textStyles.h3,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.textStyles.body1,
    color: theme.colors.textSecondary,
  },
  formCard: {
    margin: theme.spacing.screen.padding,
    marginTop: 0,
  },
  providerSection: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    ...theme.typography.textStyles.body1,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    marginBottom: theme.spacing.md,
  },
  providerGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  providerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
    backgroundColor: theme.colors.gray100,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  providerButtonActive: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary,
  },
  providerColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: theme.spacing.sm,
  },
  providerText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textPrimary,
  },
  providerTextActive: {
    color: theme.colors.primary,
    fontWeight: '500',
  },
  amountSection: {
    marginBottom: theme.spacing.lg,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  amountButton: {
    width: '48%',
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
    backgroundColor: theme.colors.gray100,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  amountButtonActive: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary,
  },
  amountButtonText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    marginBottom: theme.spacing.xs,
  },
  amountButtonTextActive: {
    color: theme.colors.primary,
  },
  amountButtonKES: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.textSecondary,
  },
  summaryCard: {
    margin: theme.spacing.screen.padding,
    marginTop: 0,
    backgroundColor: theme.colors.gray50,
  },
  summaryTitle: {
    ...theme.typography.textStyles.h6,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  summaryLabel: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textSecondary,
  },
  summaryValue: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  infoCard: {
    margin: theme.spacing.screen.padding,
    marginTop: 0,
    backgroundColor: theme.colors.info + '10',
    borderColor: theme.colors.info,
    borderWidth: 1,
  },
  infoTitle: {
    ...theme.typography.textStyles.h6,
    color: theme.colors.info,
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  buttonContainer: {
    padding: theme.spacing.screen.padding,
    paddingTop: 0,
    gap: theme.spacing.md,
  },
  buyButton: {
    marginBottom: theme.spacing.sm,
  },
  cancelButton: {
    marginBottom: theme.spacing.xl,
  },
});
