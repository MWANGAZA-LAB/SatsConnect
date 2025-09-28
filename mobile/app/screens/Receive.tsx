import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Clipboard,
  Share,
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
import { QRCodeComponent } from '../components/QRCode';
import { theme } from '../theme';
import { walletService } from '../services/walletService';

type ReceiveNavigationProp = StackNavigationProp<RootStackParamList, 'Receive'>;

export default function Receive() {
  const navigation = useNavigation<ReceiveNavigationProp>();
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [invoice, setInvoice] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(Number(amount)) || Number(amount) <= 0) {
      newErrors.amount = 'Amount must be a positive number';
    } else if (Number(amount) < 1) {
      newErrors.amount = 'Minimum amount is 1 sat';
    } else if (Number(amount) > 100000000) {
      newErrors.amount = 'Maximum amount is 1 BTC (100,000,000 sats)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateInvoice = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsGenerating(true);

      const amountSats = Math.floor(Number(amount));
      const generatedInvoice = await walletService.createInvoice(
        amountSats,
        memo || 'Payment from SatsConnect'
      );

      if (generatedInvoice) {
        setInvoice(generatedInvoice);
      } else {
        Alert.alert('Error', 'Failed to generate invoice. Please try again.');
      }
    } catch (error) {
      console.error('Generate invoice error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyInvoice = async () => {
    if (!invoice) return;

    try {
      await Clipboard.setString(invoice);
      Alert.alert('Copied', 'Invoice copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy invoice');
    }
  };

  const shareInvoice = async () => {
    if (!invoice) return;

    try {
      await Share.share({
        message: `Lightning Invoice: ${invoice}`,
        title: 'Lightning Invoice',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share invoice');
    }
  };

  const formatAmount = (value: string) => {
    // Remove any non-numeric characters
    const cleaned = value.replace(/[^0-9]/g, '');
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

  const resetForm = () => {
    setAmount('');
    setMemo('');
    setInvoice(null);
    setErrors({});
  };

  useEffect(() => {
    // Clear invoice when amount or memo changes
    if (invoice) {
      setInvoice(null);
    }
  }, [amount, memo]);

  if (isGenerating) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner text="Generating invoice..." />
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
          <Text style={styles.title}>Receive Bitcoin</Text>
          <Text style={styles.subtitle}>
            Generate a Lightning invoice to receive payments
          </Text>
        </View>

        {!invoice ? (
          <Card style={styles.formCard}>
            <Input
              label="Amount (sats)"
              placeholder="1000"
              value={amount}
              onChangeText={text => setAmount(formatAmount(text))}
              keyboardType="numeric"
              error={errors.amount}
            />

            <Input
              label="Memo - Optional"
              placeholder="What's this payment for?"
              value={memo}
              onChangeText={setMemo}
              multiline
              numberOfLines={2}
            />

            <Button
              title="Generate Invoice"
              onPress={generateInvoice}
              disabled={!amount.trim() || isGenerating}
              style={styles.generateButton}
            />
          </Card>
        ) : (
          <Card style={styles.invoiceCard}>
            <View style={styles.invoiceHeader}>
              <Text style={styles.invoiceTitle}>Lightning Invoice</Text>
              <TouchableOpacity onPress={resetForm} style={styles.resetButton}>
                <Text style={styles.resetText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.amountDisplay}>
              <Text style={styles.amountText}>
                {formatSats(Number(amount))}
              </Text>
              <Text style={styles.amountKES}>{formatKES(Number(amount))}</Text>
            </View>

            <View style={styles.qrContainer}>
              <QRCodeComponent
                value={invoice}
                size={200}
                color={theme.colors.black}
                backgroundColor={theme.colors.white}
              />
            </View>

            <View style={styles.invoiceActions}>
              <Button
                title="Copy Invoice"
                onPress={copyInvoice}
                variant="outline"
                style={styles.actionButton}
              />
              <Button
                title="Share"
                onPress={shareInvoice}
                variant="outline"
                style={styles.actionButton}
              />
            </View>

            <View style={styles.invoiceTextContainer}>
              <Text style={styles.invoiceLabel}>Invoice:</Text>
              <Text style={styles.invoiceText} selectable>
                {invoice}
              </Text>
            </View>
          </Card>
        )}

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 How to Receive</Text>
          <Text style={styles.infoText}>
            • Share the QR code or invoice with the sender{'\n'}• The sender
            scans the QR code or copies the invoice{'\n'}• Payment is usually
            received instantly{'\n'}• Keep the invoice private until payment is
            complete{'\n'}• Invoices expire after 24 hours for security
          </Text>
        </Card>

        <Card style={styles.warningCard}>
          <Text style={styles.warningTitle}>⚠️ Important</Text>
          <Text style={styles.warningText}>
            • Only share this invoice with trusted senders{'\n'}• Each invoice
            can only be used once{'\n'}• Don't share screenshots of the QR code
            publicly{'\n'}• If you need a new invoice, generate a fresh one
          </Text>
        </Card>

        <View style={styles.buttonContainer}>
          <Button
            title="Back to Home"
            onPress={() => navigation.goBack()}
            variant="outline"
            style={styles.backButton}
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
  generateButton: {
    marginTop: theme.spacing.md,
  },
  invoiceCard: {
    margin: theme.spacing.screen.padding,
    marginTop: 0,
    alignItems: 'center',
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: theme.spacing.lg,
  },
  invoiceTitle: {
    ...theme.typography.textStyles.h5,
    color: theme.colors.textPrimary,
  },
  resetButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetText: {
    ...theme.typography.textStyles.body1,
    color: theme.colors.textSecondary,
  },
  amountDisplay: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  amountText: {
    ...theme.typography.textStyles.h2,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  amountKES: {
    ...theme.typography.textStyles.h6,
    color: theme.colors.textSecondary,
  },
  qrContainer: {
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: theme.spacing.lg,
    ...theme.shadows.medium,
  },
  invoiceActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
  invoiceTextContainer: {
    width: '100%',
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
  },
  invoiceLabel: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  invoiceText: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.textPrimary,
    fontFamily: 'monospace',
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
  },
  backButton: {
    marginBottom: theme.spacing.xl,
  },
});
