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
import { QRScanner } from '../components/QRScanner';
import { theme } from '../theme';
import { walletService } from '../services/walletService';

type BillPaymentNavigationProp = StackNavigationProp<RootStackParamList, 'BillPayment'>;

const BILL_TYPES = [
  { id: 'kplc', name: 'KPLC (Electricity)', icon: '⚡', color: '#FFD700' },
  { id: 'nairobi_water', name: 'Nairobi Water', icon: '💧', color: '#1E90FF' },
  { id: 'dstv', name: 'DStv', icon: '📺', color: '#FF4500' },
  { id: 'gotv', name: 'GOtv', icon: '📺', color: '#32CD32' },
  { id: 'zuku', name: 'Zuku', icon: '📡', color: '#8A2BE2' },
  { id: 'safaricom', name: 'Safaricom Postpaid', icon: '📱', color: '#00A86B' },
  { id: 'airtel', name: 'Airtel Postpaid', icon: '📱', color: '#E60012' },
  { id: 'other', name: 'Other', icon: '🧾', color: '#696969' },
];

export default function BillPayment() {
  const navigation = useNavigation<BillPaymentNavigationProp>();
  const [billType, setBillType] = useState('kplc');
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required';
    }

    if (!amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(Number(amount)) || Number(amount) <= 0) {
      newErrors.amount = 'Amount must be a positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePayBill = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      
      const amountSats = Math.floor(Number(amount) * 100000000); // Convert BTC to sats
      
      // For now, we'll use the buyAirtime function as a placeholder
      // In a real app, you'd have a dedicated bill payment function
      const success = await walletService.buyAirtime(
        amountSats,
        accountNumber,
        billType
      );

      if (success) {
        Alert.alert(
          'Bill Payment',
          `Bill payment initiated for ${BILL_TYPES.find(b => b.id === billType)?.name}. You will receive a confirmation once the transaction is complete.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setAccountNumber('');
                setAmount('');
                setDescription('');
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to process bill payment. Please try again.');
      }
    } catch (error) {
      console.error('Pay bill error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQRScan = (data: string) => {
    // Parse QR code data (this would be more sophisticated in a real app)
    try {
      const parsed = JSON.parse(data);
      if (parsed.billType) setBillType(parsed.billType);
      if (parsed.accountNumber) setAccountNumber(parsed.accountNumber);
      if (parsed.amount) setAmount(parsed.amount);
      if (parsed.description) setDescription(parsed.description);
    } catch (error) {
      // If not JSON, try to extract account number from text
      setAccountNumber(data);
    }
    setShowQRScanner(false);
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
        <LoadingSpinner text="Processing bill payment..." />
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
          <Text style={styles.title}>Pay Bills</Text>
          <Text style={styles.subtitle}>
            Pay your utility bills with Bitcoin Lightning
          </Text>
        </View>

        <Card style={styles.formCard}>
          <View style={styles.billTypeSection}>
            <Text style={styles.sectionLabel}>Bill Type</Text>
            <View style={styles.billTypeGrid}>
              {BILL_TYPES.map((bill) => (
                <TouchableOpacity
                  key={bill.id}
                  style={[
                    styles.billTypeButton,
                    billType === bill.id && styles.billTypeButtonActive,
                  ]}
                  onPress={() => setBillType(bill.id)}
                >
                  <Text style={styles.billTypeIcon}>{bill.icon}</Text>
                  <Text
                    style={[
                      styles.billTypeText,
                      billType === bill.id && styles.billTypeTextActive,
                    ]}
                  >
                    {bill.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Input
            label="Account Number"
            placeholder="Enter your account number"
            value={accountNumber}
            onChangeText={setAccountNumber}
            error={errors.accountNumber}
            rightIcon={
              <TouchableOpacity onPress={() => setShowQRScanner(true)}>
                <Text style={styles.scanIcon}>📷</Text>
              </TouchableOpacity>
            }
            onRightIconPress={() => setShowQRScanner(true)}
          />

          <Input
            label="Amount (BTC)"
            placeholder="0.001"
            value={amount}
            onChangeText={(text) => setAmount(formatAmount(text))}
            keyboardType="numeric"
            error={errors.amount}
          />

          <Input
            label="Description - Optional"
            placeholder="What's this payment for?"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={2}
          />
        </Card>

        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Payment Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Bill Type:</Text>
            <Text style={styles.summaryValue}>
              {BILL_TYPES.find(b => b.id === billType)?.name || 'Not selected'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Account Number:</Text>
            <Text style={styles.summaryValue}>{accountNumber || 'Not specified'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount:</Text>
            <Text style={styles.summaryValue}>
              {amount 
                ? `${formatSats(Number(amount) * 100000000)} (${formatKES(Number(amount) * 100000000)})`
                : 'Not specified'
              }
            </Text>
          </View>
        </Card>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 Bill Payment Info</Text>
          <Text style={styles.infoText}>
            • Payments are usually processed within 5-10 minutes{'\n'}
            • You can scan QR codes from your bill statements{'\n'}
            • Keep your payment receipt for reference{'\n'}
            • Contact customer service if payment is not reflected{'\n'}
            • All transactions are processed via Lightning Network
          </Text>
        </Card>

        <Card style={styles.warningCard}>
          <Text style={styles.warningTitle}>⚠️ Important</Text>
          <Text style={styles.warningText}>
            • Double-check your account number before paying{'\n'}
            • Ensure you have sufficient balance for the payment{'\n'}
            • Keep your payment confirmation for records{'\n'}
            • Contact the service provider if you have issues
          </Text>
        </Card>

        <View style={styles.buttonContainer}>
          <Button
            title="Pay Bill"
            onPress={handlePayBill}
            disabled={!accountNumber.trim() || !amount.trim() || isLoading}
            style={styles.payButton}
          />
          
          <Button
            title="Cancel"
            onPress={() => navigation.goBack()}
            variant="outline"
            style={styles.cancelButton}
          />
        </View>
      </ScrollView>

      {showQRScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
          visible={showQRScanner}
        />
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
  billTypeSection: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    ...theme.typography.textStyles.body1,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    marginBottom: theme.spacing.md,
  },
  billTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  billTypeButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
    backgroundColor: theme.colors.gray100,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  billTypeButtonActive: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary,
  },
  billTypeIcon: {
    fontSize: 20,
    marginRight: theme.spacing.sm,
  },
  billTypeText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  billTypeTextActive: {
    color: theme.colors.primary,
    fontWeight: '500',
  },
  scanIcon: {
    fontSize: 20,
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
    flex: 1,
    textAlign: 'right',
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
  warningCard: {
    margin: theme.spacing.screen.padding,
    marginTop: 0,
    backgroundColor: theme.colors.warning + '10',
    borderColor: theme.colors.warning,
    borderWidth: 1,
  },
  warningTitle: {
    ...theme.typography.textStyles.h6,
    color: theme.colors.warning,
    marginBottom: theme.spacing.sm,
  },
  warningText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  buttonContainer: {
    padding: theme.spacing.screen.padding,
    paddingTop: 0,
    gap: theme.spacing.md,
  },
  payButton: {
    marginBottom: theme.spacing.sm,
  },
  cancelButton: {
    marginBottom: theme.spacing.xl,
  },
});
