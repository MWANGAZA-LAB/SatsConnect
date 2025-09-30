import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { theme } from '../theme';
import { walletService } from '../services/walletService';
import { authService } from '../services/authService';

type HomeNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

export default function Home() {
  const navigation = useNavigation<HomeNavigationProp>();
  const [walletState, setWalletState] = useState(
    walletService.getWalletState()
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<'BTC' | 'KES' | 'USD'>('BTC');
  const [exchangeRates, setExchangeRates] = useState({
    BTC: 1,
    KES: 4000000, // Mock rate: 1 BTC = 4M KES
    USD: 40000,   // Mock rate: 1 BTC = 40K USD
  });

  useFocusEffect(
    React.useCallback(() => {
      refreshWallet();
    }, [])
  );

  useEffect(() => {
    const unsubscribe = walletService.subscribe(setWalletState);
    return unsubscribe;
  }, []);

  const refreshWallet = async () => {
    setIsRefreshing(true);
    await walletService.refreshBalance();
    await walletService.loadTransactions();
    setIsRefreshing(false);
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

  const formatCurrency = (sats: number, currency: 'BTC' | 'KES' | 'USD') => {
    const btc = sats / 100000000;
    
    switch (currency) {
      case 'BTC':
        if (sats >= 100000000) {
          return `${btc.toFixed(8)} BTC`;
        } else if (sats >= 1000) {
          return `${(sats / 1000).toFixed(1)}K sats`;
        } else {
          return `${sats} sats`;
        }
      case 'KES':
        const kes = btc * exchangeRates.KES;
        return `≈ ${kes.toLocaleString('en-KE')} KES`;
      case 'USD':
        const usd = btc * exchangeRates.USD;
        return `≈ $${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      default:
        return formatSats(sats);
    }
  };

  const getCurrencySymbol = (currency: 'BTC' | 'KES' | 'USD') => {
    switch (currency) {
      case 'BTC': return '₿';
      case 'KES': return 'KSh';
      case 'USD': return '$';
      default: return '';
    }
  };

  const handleSend = () => {
    navigation.navigate('Send');
  };

  const handleReceive = () => {
    navigation.navigate('Receive');
  };

  const handleHistory = () => {
    navigation.navigate('History');
  };

  const handleBuyAirtime = () => {
    navigation.navigate('Airtime');
  };

  const handlePayBill = () => {
    navigation.navigate('BillPayment');
  };

  const toggleBalanceVisibility = () => {
    setShowBalance(!showBalance);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await authService.logout();
          navigation.replace('Onboarding');
        },
      },
    ]);
  };

  if (walletState.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner text="Loading wallet..." />
      </View>
    );
  }

  if (!walletState.wallet) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>No Wallet Found</Text>
        <Text style={styles.errorText}>
          Please create a wallet to continue.
        </Text>
        <Button
          title="Create Wallet"
          onPress={() => navigation.replace('Onboarding')}
          style={styles.errorButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshWallet} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.greeting}>Hello! 👋</Text>
            <TouchableOpacity
              onPress={handleLogout}
              style={styles.logoutButton}
            >
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.walletLabel}>{walletState.wallet.label}</Text>
        </View>

        {/* Balance Card */}
        <Card style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <View style={styles.balanceControls}>
              <View style={styles.currencySelector}>
                {(['BTC', 'KES', 'USD'] as const).map((currency) => (
                  <TouchableOpacity
                    key={currency}
                    style={[
                      styles.currencyButton,
                      selectedCurrency === currency && styles.currencyButtonActive
                    ]}
                    onPress={() => setSelectedCurrency(currency)}
                  >
                    <Text style={[
                      styles.currencyButtonText,
                      selectedCurrency === currency && styles.currencyButtonTextActive
                    ]}>
                      {getCurrencySymbol(currency)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={toggleBalanceVisibility} style={styles.visibilityButton}>
                <Text style={styles.toggleText}>{showBalance ? '👁️' : '🙈'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {showBalance ? (
            <>
              <Text style={styles.balanceAmount}>
                {formatCurrency(walletState.balance.totalSats, selectedCurrency)}
              </Text>
              
              {/* Show other currencies as secondary info */}
              {selectedCurrency !== 'BTC' && (
                <Text style={styles.balanceSecondary}>
                  {formatSats(walletState.balance.totalSats)}
                </Text>
              )}
              
              {selectedCurrency === 'BTC' && (
                <View style={styles.currencyEquivalents}>
                  <Text style={styles.currencyEquivalent}>
                    {formatCurrency(walletState.balance.totalSats, 'KES')}
                  </Text>
                  <Text style={styles.currencyEquivalent}>
                    {formatCurrency(walletState.balance.totalSats, 'USD')}
                  </Text>
                </View>
              )}

              <View style={styles.balanceBreakdown}>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceItemLabel}>On-chain</Text>
                  <Text style={styles.balanceItemValue}>
                    {formatCurrency(walletState.balance.confirmedSats, selectedCurrency)}
                  </Text>
                </View>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceItemLabel}>Lightning</Text>
                  <Text style={styles.balanceItemValue}>
                    {formatCurrency(walletState.balance.lightningSats, selectedCurrency)}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.hiddenBalance}>••••••••</Text>
          )}
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={handleSend}>
              <Text style={styles.actionIcon}>📤</Text>
              <Text style={styles.actionLabel}>Send</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleReceive}
            >
              <Text style={styles.actionIcon}>📥</Text>
              <Text style={styles.actionLabel}>Receive</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleBuyAirtime}
            >
              <Text style={styles.actionIcon}>📱</Text>
              <Text style={styles.actionLabel}>Airtime</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handlePayBill}
            >
              <Text style={styles.actionIcon}>🧾</Text>
              <Text style={styles.actionLabel}>Pay Bill</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.recentTransactions}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={handleHistory}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {walletState.transactions.length > 0 ? (
            <View style={styles.transactionList}>
              {walletState.transactions.slice(0, 3).map(transaction => (
                <Card key={transaction.id} style={styles.transactionCard}>
                  <View style={styles.transactionHeader}>
                    <Text style={styles.transactionType}>
                      {transaction.type === 'send'
                        ? '📤'
                        : transaction.type === 'receive'
                          ? '📥'
                          : transaction.type === 'airtime'
                            ? '📱'
                            : '🧾'}
                    </Text>
                    <Text style={styles.transactionAmount}>
                      {transaction.type === 'send' ? '-' : '+'}
                      {formatSats(transaction.amount)}
                    </Text>
                  </View>
                  <Text style={styles.transactionDescription}>
                    {transaction.description}
                  </Text>
                  <Text style={styles.transactionTime}>
                    {new Date(transaction.timestamp).toLocaleDateString()}
                  </Text>
                </Card>
              ))}
            </View>
          ) : (
            <Card style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No transactions yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Start by sending or receiving Bitcoin
              </Text>
            </Card>
          )}
        </View>

        {/* Error Display */}
        {walletState.error && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorMessage}>{walletState.error}</Text>
            <Button
              title="Retry"
              onPress={() => walletService.clearError()}
              variant="outline"
              size="small"
              style={styles.retryButton}
            />
          </Card>
        )}
      </ScrollView>
    </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.screen.padding,
  },
  errorTitle: {
    ...theme.typography.textStyles.h3,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.textStyles.body1,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  errorButton: {
    minWidth: 200,
  },
  header: {
    padding: theme.spacing.screen.padding,
    paddingBottom: theme.spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  greeting: {
    ...theme.typography.textStyles.h4,
    color: theme.colors.textPrimary,
  },
  logoutButton: {
    padding: theme.spacing.sm,
  },
  logoutText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.primary,
  },
  walletLabel: {
    ...theme.typography.textStyles.body1,
    color: theme.colors.textSecondary,
  },
  balanceCard: {
    margin: theme.spacing.screen.padding,
    marginTop: 0,
    alignItems: 'center',
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  balanceControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  currencySelector: {
    flexDirection: 'row',
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.spacing.sm,
    padding: 2,
  },
  currencyButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.spacing.xs,
  },
  currencyButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  currencyButtonText: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  currencyButtonTextActive: {
    color: theme.colors.white,
  },
  visibilityButton: {
    padding: theme.spacing.xs,
  },
  balanceLabel: {
    ...theme.typography.textStyles.body1,
    color: theme.colors.textSecondary,
  },
  toggleText: {
    fontSize: 20,
  },
  balanceAmount: {
    ...theme.typography.textStyles.h1,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  balanceSecondary: {
    ...theme.typography.textStyles.h6,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  currencyEquivalents: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  currencyEquivalent: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textSecondary,
  },
  hiddenBalance: {
    ...theme.typography.textStyles.h1,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
  },
  balanceBreakdown: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
  },
  balanceItem: {
    alignItems: 'center',
  },
  balanceItemLabel: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  balanceItemValue: {
    ...theme.typography.textStyles.h6,
    color: theme.colors.textPrimary,
  },
  quickActions: {
    padding: theme.spacing.screen.padding,
    paddingTop: 0,
  },
  sectionTitle: {
    ...theme.typography.textStyles.h5,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadows.small,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: theme.spacing.sm,
  },
  actionLabel: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  recentTransactions: {
    padding: theme.spacing.screen.padding,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  viewAllText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.primary,
  },
  transactionList: {
    gap: theme.spacing.sm,
  },
  transactionCard: {
    padding: theme.spacing.md,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  transactionType: {
    fontSize: 20,
  },
  transactionAmount: {
    ...theme.typography.textStyles.h6,
    color: theme.colors.textPrimary,
  },
  transactionDescription: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  transactionTime: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyStateText: {
    ...theme.typography.textStyles.h6,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  emptyStateSubtext: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  errorCard: {
    margin: theme.spacing.screen.padding,
    marginTop: 0,
    backgroundColor: theme.colors.error + '10',
    borderColor: theme.colors.error,
    borderWidth: 1,
  },
  errorMessage: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.error,
    marginBottom: theme.spacing.sm,
  },
  retryButton: {
    alignSelf: 'flex-start',
  },
});
