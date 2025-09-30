import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
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

type HistoryNavigationProp = StackNavigationProp<RootStackParamList, 'History'>;

export default function History() {
  const navigation = useNavigation<HistoryNavigationProp>();
  const [walletState, setWalletState] = useState(
    walletService.getWalletState()
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<
    'all' | 'send' | 'receive' | 'airtime' | 'bill'
  >('all');

  useFocusEffect(
    React.useCallback(() => {
      refreshTransactions();
    }, [])
  );

  useEffect(() => {
    const unsubscribe = walletService.subscribe(setWalletState);
    return unsubscribe;
  }, []);

  const refreshTransactions = async () => {
    setIsRefreshing(true);
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

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) {
      // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'send':
        return '📤';
      case 'receive':
        return '📥';
      case 'airtime':
        return '📱';
      case 'bill':
        return '🧾';
      default:
        return '💰';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return theme.colors.success;
      case 'pending':
        return theme.colors.warning;
      case 'failed':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'pending':
        return '⏳';
      case 'failed':
        return '❌';
      default:
        return '❓';
    }
  };

  const filteredTransactions = walletState.transactions.filter(transaction => {
    if (filter === 'all') return true;
    return transaction.type === filter;
  });

  const handleTransactionPress = (transaction: any) => {
    Alert.alert(
      'Transaction Details',
      `Type: ${transaction.type}\nAmount: ${formatSats(transaction.amount)}\nStatus: ${transaction.status}\nTime: ${new Date(transaction.timestamp).toLocaleString()}\nDescription: ${transaction.description || 'N/A'}`,
      [{ text: 'OK' }]
    );
  };

  const handleRefresh = () => {
    refreshTransactions();
  };

  const handleFilterChange = (newFilter: typeof filter) => {
    setFilter(newFilter);
  };

  if (walletState.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner text="Loading transactions..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transaction History</Text>
        <Text style={styles.subtitle}>
          {filteredTransactions.length} transaction
          {filteredTransactions.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterButtons}>
            {[
              { key: 'all', label: 'All' },
              { key: 'send', label: 'Sent' },
              { key: 'receive', label: 'Received' },
              { key: 'airtime', label: 'Airtime' },
              { key: 'bill', label: 'Bills' },
            ].map(filterOption => (
              <TouchableOpacity
                key={filterOption.key}
                style={[
                  styles.filterButton,
                  filter === filterOption.key && styles.filterButtonActive,
                ]}
                onPress={() =>
                  handleFilterChange(filterOption.key as typeof filter)
                }
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filter === filterOption.key &&
                      styles.filterButtonTextActive,
                  ]}
                >
                  {filterOption.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredTransactions.length > 0 ? (
          <View style={styles.transactionList}>
            {filteredTransactions.map(transaction => (
              <TouchableOpacity
                key={transaction.id}
                onPress={() => handleTransactionPress(transaction)}
              >
                <Card style={styles.transactionCard}>
                  <View style={styles.transactionHeader}>
                    <View style={styles.transactionIcon}>
                      <Text style={styles.transactionIconText}>
                        {getTransactionIcon(transaction.type)}
                      </Text>
                    </View>

                    <View style={styles.transactionDetails}>
                      <Text style={styles.transactionType}>
                        {transaction.type.charAt(0).toUpperCase() +
                          transaction.type.slice(1)}
                      </Text>
                      <Text style={styles.transactionDescription}>
                        {transaction.description || 'No description'}
                      </Text>
                    </View>

                    <View style={styles.transactionAmount}>
                      <Text
                        style={[
                          styles.transactionAmountText,
                          {
                            color:
                              transaction.type === 'send'
                                ? theme.colors.error
                                : theme.colors.success,
                          },
                        ]}
                      >
                        {transaction.type === 'send' ? '-' : '+'}
                        {formatSats(transaction.amount)}
                      </Text>
                      <Text style={styles.transactionTime}>
                        {formatDate(transaction.timestamp.toString())}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.transactionFooter}>
                    <View style={styles.statusContainer}>
                      <Text style={styles.statusIcon}>
                        {getStatusIcon(transaction.status)}
                      </Text>
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(transaction.status) },
                        ]}
                      >
                        {transaction.status.charAt(0).toUpperCase() +
                          transaction.status.slice(1)}
                      </Text>
                    </View>

                    {transaction.txHash && (
                      <Text style={styles.paymentHash}>
                        {transaction.txHash.substring(0, 16)}...
                      </Text>
                    )}
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📊</Text>
            <Text style={styles.emptyStateTitle}>
              {filter === 'all'
                ? 'No transactions yet'
                : `No ${filter} transactions`}
            </Text>
            <Text style={styles.emptyStateText}>
              {filter === 'all'
                ? 'Your transaction history will appear here'
                : `No ${filter} transactions found. Try a different filter.`}
            </Text>

            {filter === 'all' && (
              <View style={styles.emptyStateActions}>
                <Button
                  title="Send Bitcoin"
                  onPress={() => navigation.navigate('Send')}
                  style={styles.emptyStateButton}
                />
                <Button
                  title="Receive Bitcoin"
                  onPress={() => navigation.navigate('Receive')}
                  variant="outline"
                  style={styles.emptyStateButton}
                />
              </View>
            )}
          </View>
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
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.textStyles.body1,
    color: theme.colors.textSecondary,
  },
  filterContainer: {
    paddingHorizontal: theme.spacing.screen.padding,
    marginBottom: theme.spacing.md,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  filterButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.spacing.sm,
    backgroundColor: theme.colors.gray100,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  filterButtonText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textSecondary,
  },
  filterButtonTextActive: {
    color: theme.colors.white,
  },
  scrollView: {
    flex: 1,
  },
  transactionList: {
    padding: theme.spacing.screen.padding,
    paddingTop: 0,
  },
  transactionCard: {
    marginBottom: theme.spacing.sm,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  transactionIconText: {
    fontSize: 20,
  },
  transactionDetails: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  transactionType: {
    ...theme.typography.textStyles.body1,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    marginBottom: theme.spacing.xs,
  },
  transactionDescription: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textSecondary,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    ...theme.typography.textStyles.h6,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  transactionTime: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.textSecondary,
  },
  transactionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: theme.spacing.xs,
  },
  statusText: {
    ...theme.typography.textStyles.caption,
    fontWeight: '500',
  },
  paymentHash: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.textSecondary,
    fontFamily: 'monospace',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.screen.padding,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
  },
  emptyStateTitle: {
    ...theme.typography.textStyles.h4,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptyStateText: {
    ...theme.typography.textStyles.body1,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  emptyStateActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  emptyStateButton: {
    minWidth: 120,
  },
});
