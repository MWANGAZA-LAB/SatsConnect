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

type SendNavigationProp = StackNavigationProp<RootStackParamList, 'Send'>;

export default function Send() {
  const navigation = useNavigation<SendNavigationProp>();
  const [invoice, setInvoice] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!invoice.trim()) {
      newErrors.invoice = 'Invoice is required';
    } else if (!invoice.startsWith('lnbc')) {
      newErrors.invoice = 'Invalid Lightning invoice format';
    }

    if (amount && (isNaN(Number(amount)) || Number(amount) <= 0)) {
      newErrors.amount = 'Amount must be a positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSend = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);

      const amountSats = amount ? Math.floor(Number(amount) * 100000000) : 0; // Convert BTC to sats

      const success = await walletService.sendPayment(
        invoice,
        amountSats,
        description || 'Payment sent'
      );

      if (success) {
        Alert.alert(
          'Payment Sent',
          'Your payment has been sent successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                setInvoice('');
                setAmount('');
                setDescription('');
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to send payment. Please try again.');
      }
    } catch (error) {
      console.error('Send payment error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQRScan = (data: string) => {
    setInvoice(data);
    setShowQRScanner(false);
  };

  const handlePaste = async () => {
    try {
      // In a real app, you'd use Clipboard API
      // For now, we'll just show an alert
      Alert.alert(
        'Paste',
        'Paste functionality will be implemented with clipboard integration'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to paste from clipboard');
    }
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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner text="Sending payment..." />
      </View>
    );
  }

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
          <Text style={styles.title}>Send Bitcoin</Text>
          <Text style={styles.subtitle}>
            Enter a Lightning invoice or scan a QR code
          </Text>
        </View>

        <Card style={styles.formCard}>
          <Input
            label="Lightning Invoice"
            placeholder="lnbc1..."
            value={invoice}
            onChangeText={setInvoice}
            error={errors.invoice}
            multiline
            numberOfLines={3}
            rightIcon={
              <View style={styles.inputActions}>
                <TouchableOpacity onPress={() => setShowQRScanner(true)}>
                  <Text style={styles.actionText}>📷</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handlePaste}>
                  <Text style={styles.actionText}>📋</Text>
                </TouchableOpacity>
              </View>
            }
            onRightIconPress={() => setShowQRScanner(true)}
          />

          <Input
            label="Amount (BTC) - Optional"
            placeholder="0.001"
            value={amount}
            onChangeText={text => setAmount(formatAmount(text))}
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

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 Payment Tips</Text>
          <Text style={styles.infoText}>
            • Lightning invoices include the amount, so you don't need to
            specify it separately{'\n'}• Always verify the recipient before
            sending{'\n'}• Payments are usually instant but can take a few
            minutes{'\n'}• Keep your invoice private - anyone with it can see
            the payment details
          </Text>
        </Card>

        <View style={styles.buttonContainer}>
          <Button
            title="Send Payment"
            onPress={handleSend}
            disabled={!invoice.trim() || isLoading}
            style={styles.sendButton}
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
  inputActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionText: {
    fontSize: 20,
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
  sendButton: {
    marginBottom: theme.spacing.sm,
  },
  cancelButton: {
    marginBottom: theme.spacing.xl,
  },
});
