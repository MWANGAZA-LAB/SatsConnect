import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { theme } from '../theme';
import { apiService } from '../services/api';
import { walletService } from '../services/walletService';

type SellBitcoinNavigationProp = StackNavigationProp<RootStackParamList, 'SellBitcoin'>;

interface ExchangeRates {
  BTC: number;
  KES: number;
  USD: number;
}

interface MpesaLimits {
  minAmount: number;
  maxAmount: number;
  dailyLimit: number;
  currency: string;
}

export default function SellBitcoin() {
  const navigation = useNavigation<SellBitcoinNavigationProp>();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({
    BTC: 1,
    KES: 0,
    USD: 0,
  });
  const [mpesaLimits, setMpesaLimits] = useState<MpesaLimits>({
    minAmount: 1,
    maxAmount: 150000,
    dailyLimit: 300000,
    currency: 'KES',
  });
  const [currentWallet, setCurrentWallet] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    fetchExchangeRates();
    fetchMpesaLimits();
    getCurrentWallet();
  }, []);

  const fetchExchangeRates = async () => {
    try {
      const response = await apiService.getExchangeRate();
      if (response.success && response.data) {
        setExchangeRates({
          BTC: 1,
          KES: response.data.rate,
          USD: response.data.rate / 100, // Approximate USD rate
        });
      }
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
    }
  };

  const fetchMpesaLimits = async () => {
    try {
      const response = await apiService.getMpesaLimits();
      if (response.success && response.data) {
        setMpesaLimits(response.data.payout);
      }
    } catch (error) {
      console.error('Failed to fetch MPesa limits:', error);
    }
  };

  const getCurrentWallet = async () => {
    try {
      const wallet = await walletService.getCurrentWallet();
      setCurrentWallet(wallet);
      
      if (wallet) {
        const balance = await walletService.getBalance();
        setWalletBalance(balance.lightningSats || 0);
      }
    } catch (error) {
      console.error('Failed to get current wallet:', error);
    }
  };

  const formatKES = (sats: number) => {
    const kesAmount = (sats / 100000000) * (exchangeRates.KES || 4000000);
    return `₦${kesAmount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
  };

  const formatSats = (kes: number) => {
    const sats = (kes / (exchangeRates.KES || 4000000)) * 100000000;
    return Math.round(sats);
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    // Validate phone number
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!/^(\+254|254|0)?[17]\d{8}$/.test(phoneNumber.replace(/\s/g, ''))) {
      newErrors.phoneNumber = 'Please enter a valid Kenyan phone number';
    }

    // Validate amount
    if (!amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        newErrors.amount = 'Please enter a valid amount';
      } else if (numAmount < mpesaLimits.minAmount) {
        newErrors.amount = `Minimum amount is ${mpesaLimits.currency} ${mpesaLimits.minAmount}`;
      } else if (numAmount > mpesaLimits.maxAmount) {
        newErrors.amount = `Maximum amount is ${mpesaLimits.currency} ${mpesaLimits.maxAmount}`;
      } else {
        const requiredSats = formatSats(numAmount);
        if (requiredSats > walletBalance) {
          newErrors.amount = `Insufficient balance. You have ${formatKES(walletBalance)}`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSellBitcoin = async () => {
    if (!validateForm()) {
      return;
    }

    if (!currentWallet) {
      Alert.alert('Error', 'No wallet found. Please create a wallet first.');
      return;
    }

    const requiredSats = formatSats(parseFloat(amount));
    if (requiredSats > walletBalance) {
      Alert.alert('Insufficient Balance', `You need ${requiredSats.toLocaleString()} sats but only have ${walletBalance.toLocaleString()} sats.`);
      return;
    }

    setIsProcessing(true);

    try {
      // First, generate a Lightning invoice for the amount
      const invoiceResponse = await walletService.generateInvoice(
        requiredSats,
        `Sell Bitcoin - ${phoneNumber}`
      );

      if (!invoiceResponse.success) {
        throw new Error(invoiceResponse.error || 'Failed to generate invoice');
      }

      // Then initiate the MPesa payout
      const response = await apiService.sellBitcoinWithMpesa({
        phoneNumber: phoneNumber.replace(/\s/g, ''),
        amount: parseFloat(amount),
        lightningInvoice: invoiceResponse.data?.invoice || '',
        accountReference: `SATS_SELL_${Date.now()}`,
        transactionDesc: 'Bitcoin Sale',
      });

      if (response.success) {
        Alert.alert(
          'Sale Initiated',
          'Your Bitcoin sale has been initiated. You will receive KES in your MPesa account shortly.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to transaction status or home
                navigation.navigate('Home');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to initiate Bitcoin sale');
      }
    } catch (error) {
      console.error('Sell Bitcoin error:', error);
      Alert.alert('Error', 'Failed to initiate Bitcoin sale. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAmountChange = (text: string) => {
    // Remove any non-numeric characters except decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    
    // Only allow one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return;
    }
    
    setAmount(cleaned);
  };

  const suggestedAmounts = [100, 500, 1000, 2500, 5000];

  const maxSellableKES = Math.floor((walletBalance / 100000000) * (exchangeRates.KES || 4000000));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Sell Bitcoin</Text>
          <Text style={styles.subtitle}>
            Sell Bitcoin and receive KES in your MPesa account
          </Text>
        </View>

        <Card style={styles.balanceCard}>
          <Text style={styles.balanceTitle}>💰 Your Balance</Text>
          <Text style={styles.balanceAmount}>
            {walletBalance.toLocaleString()} sats
          </Text>
          <Text style={styles.balanceKES}>
            ≈ {formatKES(walletBalance)}
          </Text>
        </Card>

        <Card style={styles.formCard}>
          <Input
            label="Phone Number"
            placeholder="0712345678 or +254712345678"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            error={errors.phoneNumber}
          />

          <View style={styles.amountSection}>
            <Text style={styles.sectionLabel}>Amount (KES)</Text>
            
            <Input
              placeholder="Enter amount"
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="numeric"
              error={errors.amount}
            />

            <View style={styles.suggestedAmounts}>
              <Text style={styles.suggestedLabel}>Quick amounts:</Text>
              <View style={styles.amountButtons}>
                {suggestedAmounts
                  .filter(amt => amt <= maxSellableKES)
                  .map((suggestedAmount) => (
                    <TouchableOpacity
                      key={suggestedAmount}
                      style={[
                        styles.amountButton,
                        amount === suggestedAmount.toString() && styles.amountButtonActive,
                      ]}
                      onPress={() => setAmount(suggestedAmount.toString())}
                    >
                      <Text
                        style={[
                          styles.amountButtonText,
                          amount === suggestedAmount.toString() && styles.amountButtonTextActive,
                        ]}
                      >
                        {suggestedAmount}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          </View>

          {amount && !isNaN(parseFloat(amount)) && (
            <Card style={styles.conversionCard}>
              <Text style={styles.conversionTitle}>Conversion</Text>
              <View style={styles.conversionRow}>
                <Text style={styles.conversionLabel}>KES Amount:</Text>
                <Text style={styles.conversionValue}>
                  ₦{parseFloat(amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.conversionRow}>
                <Text style={styles.conversionLabel}>Bitcoin (sats):</Text>
                <Text style={styles.conversionValue}>
                  {formatSats(parseFloat(amount)).toLocaleString()} sats
                </Text>
              </View>
              <View style={styles.conversionRow}>
                <Text style={styles.conversionLabel}>Bitcoin (BTC):</Text>
                <Text style={styles.conversionValue}>
                  {(formatSats(parseFloat(amount)) / 100000000).toFixed(8)} BTC
                </Text>
              </View>
            </Card>
          )}
        </Card>

        <Card style={styles.limitsCard}>
          <Text style={styles.limitsTitle}>📋 Transaction Limits</Text>
          <View style={styles.limitsRow}>
            <Text style={styles.limitsLabel}>Minimum:</Text>
            <Text style={styles.limitsValue}>
              {mpesaLimits.currency} {mpesaLimits.minAmount.toLocaleString()}
            </Text>
          </View>
          <View style={styles.limitsRow}>
            <Text style={styles.limitsLabel}>Maximum:</Text>
            <Text style={styles.limitsValue}>
              {mpesaLimits.currency} {mpesaLimits.maxAmount.toLocaleString()}
            </Text>
          </View>
          <View style={styles.limitsRow}>
            <Text style={styles.limitsLabel}>Your Max:</Text>
            <Text style={styles.limitsValue}>
              {mpesaLimits.currency} {maxSellableKES.toLocaleString()}
            </Text>
          </View>
        </Card>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 How it works</Text>
          <Text style={styles.infoText}>
            1. Enter your phone number and amount{'\n'}
            2. Tap "Sell Bitcoin" to initiate the sale{'\n'}
            3. Your Bitcoin will be converted to KES{'\n'}
            4. KES will be sent to your MPesa account{'\n'}
            5. Transaction usually completes in 5-10 minutes
          </Text>
        </Card>

        <Card style={styles.warningCard}>
          <Text style={styles.warningTitle}>⚠️ Important</Text>
          <Text style={styles.warningText}>
            • Ensure you have sufficient Bitcoin balance{'\n'}
            • Double-check the amount before confirming{'\n'}
            • Keep your phone nearby for notifications{'\n'}
            • Contact support if transaction fails
          </Text>
        </Card>

        <View style={styles.buttonContainer}>
          <Button
            title={isProcessing ? 'Processing...' : 'Sell Bitcoin'}
            onPress={handleSellBitcoin}
            disabled={!phoneNumber.trim() || !amount.trim() || isProcessing}
            style={styles.sellButton}
          />

          <Button
            title="Cancel"
            onPress={() => navigation.goBack()}
            variant="outline"
            style={styles.cancelButton}
          />
        </View>
      </ScrollView>

      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.processingText}>
              Processing your sale...
            </Text>
            <Text style={styles.processingSubtext}>
              Please wait while we process your request
            </Text>
          </View>
        </View>
      )}
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
    padding: theme.spacing.md,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  balanceCard: {
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.primary,
  },
  balanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: theme.spacing.xs,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  balanceKES: {
    fontSize: 16,
    color: theme.colors.white,
    opacity: 0.8,
  },
  formCard: {
    marginBottom: theme.spacing.md,
  },
  amountSection: {
    marginTop: theme.spacing.md,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  suggestedAmounts: {
    marginTop: theme.spacing.sm,
  },
  suggestedLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  amountButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  amountButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  amountButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  amountButtonText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  amountButtonTextActive: {
    color: theme.colors.white,
  },
  conversionCard: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  conversionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  conversionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  conversionLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  conversionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  limitsCard: {
    marginBottom: theme.spacing.md,
  },
  limitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  limitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  limitsLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  limitsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  infoCard: {
    marginBottom: theme.spacing.md,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  warningCard: {
    marginBottom: theme.spacing.lg,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.warning,
    marginBottom: theme.spacing.sm,
  },
  warningText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  buttonContainer: {
    gap: theme.spacing.sm,
  },
  sellButton: {
    backgroundColor: theme.colors.success,
  },
  cancelButton: {
    borderColor: theme.colors.border,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingCard: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    margin: theme.spacing.lg,
  },
  processingText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  processingSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
});
