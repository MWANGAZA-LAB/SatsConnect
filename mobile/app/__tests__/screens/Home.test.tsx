import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Home from '../../screens/Home';
import { walletService } from '../../services/walletService';
import { authService } from '../../services/authService';

// Mock services
jest.mock('../../services/walletService');
jest.mock('../../services/authService');

const mockWalletService = walletService as jest.Mocked<typeof walletService>;
const mockAuthService = authService as jest.Mocked<typeof authService>;

// Mock navigation
const Stack = createStackNavigator();
const MockedHome = () => (
  <NavigationContainer>
    <Stack.Navigator>
      <Stack.Screen name="Home" component={Home} />
    </Stack.Navigator>
  </NavigationContainer>
);

describe('Home Screen', () => {
  const mockWallet = {
    id: 'test-wallet-123',
    label: 'Test Wallet',
    nodeId: 'test-node-id',
    address: 'test-address',
    createdAt: '2023-01-01T00:00:00Z',
  };

  const mockBalance = {
    totalSats: 1500000,
    confirmedSats: 1000000,
    lightningSats: 500000,
  };

  const mockTransactions = [
    {
      id: 'tx1',
      type: 'send' as const,
      amount: 100000,
      status: 'completed' as const,
      timestamp: '2023-01-01T10:00:00Z',
      description: 'Sent to friend',
    },
    {
      id: 'tx2',
      type: 'receive' as const,
      amount: 200000,
      status: 'completed' as const,
      timestamp: '2023-01-01T11:00:00Z',
      description: 'Received from friend',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockWalletService.getWalletState.mockReturnValue({
      wallet: mockWallet,
      balance: mockBalance,
      transactions: mockTransactions,
      isLoading: false,
      error: null,
    });
    
    mockWalletService.subscribe.mockReturnValue(() => {});
    mockWalletService.refreshBalance.mockResolvedValue();
    mockWalletService.loadTransactions.mockResolvedValue();
  });

  it('renders wallet information correctly', () => {
    const { getByText } = render(<MockedHome />);
    
    expect(getByText('Hello! 👋')).toBeTruthy();
    expect(getByText('Test Wallet')).toBeTruthy();
    expect(getByText('Total Balance')).toBeTruthy();
  });

  it('displays balance in selected currency', () => {
    const { getByText } = render(<MockedHome />);
    
    // Should show BTC by default
    expect(getByText('0.01500000 BTC')).toBeTruthy();
  });

  it('switches currency when currency button is pressed', async () => {
    const { getByText } = render(<MockedHome />);
    
    // Press KES currency button
    fireEvent.press(getByText('KSh'));
    
    await waitFor(() => {
      expect(getByText('≈ 60,000 KES')).toBeTruthy();
    });
  });

  it('toggles balance visibility', () => {
    const { getByText, queryByText } = render(<MockedHome />);
    
    // Initially shows balance
    expect(getByText('0.01500000 BTC')).toBeTruthy();
    
    // Press visibility toggle
    fireEvent.press(getByText('👁️'));
    
    // Should hide balance
    expect(queryByText('0.01500000 BTC')).toBeNull();
    expect(getByText('••••••••')).toBeTruthy();
  });

  it('displays recent transactions', () => {
    const { getByText } = render(<MockedHome />);
    
    expect(getByText('Recent Transactions')).toBeTruthy();
    expect(getByText('Sent to friend')).toBeTruthy();
    expect(getByText('Received from friend')).toBeTruthy();
  });

  it('shows empty state when no transactions', () => {
    mockWalletService.getWalletState.mockReturnValue({
      wallet: mockWallet,
      balance: mockBalance,
      transactions: [],
      isLoading: false,
      error: null,
    });

    const { getByText } = render(<MockedHome />);
    
    expect(getByText('No transactions yet')).toBeTruthy();
    expect(getByText('Start by sending or receiving Bitcoin')).toBeTruthy();
  });

  it('handles quick actions', () => {
    const { getByText } = render(<MockedHome />);
    
    // Check that quick action buttons are rendered
    expect(getByText('Send')).toBeTruthy();
    expect(getByText('Receive')).toBeTruthy();
    expect(getByText('Airtime')).toBeTruthy();
    expect(getByText('Pay Bill')).toBeTruthy();
  });

  it('shows loading state', () => {
    mockWalletService.getWalletState.mockReturnValue({
      wallet: null,
      balance: { totalSats: 0, confirmedSats: 0, lightningSats: 0 },
      transactions: [],
      isLoading: true,
      error: null,
    });

    const { getByText } = render(<MockedHome />);
    
    expect(getByText('Loading wallet...')).toBeTruthy();
  });

  it('shows error state when no wallet', () => {
    mockWalletService.getWalletState.mockReturnValue({
      wallet: null,
      balance: { totalSats: 0, confirmedSats: 0, lightningSats: 0 },
      transactions: [],
      isLoading: false,
      error: null,
    });

    const { getByText } = render(<MockedHome />);
    
    expect(getByText('No Wallet Found')).toBeTruthy();
    expect(getByText('Please create a wallet to continue.')).toBeTruthy();
    expect(getByText('Create Wallet')).toBeTruthy();
  });

  it('handles logout', () => {
    const { getByText } = render(<MockedHome />);
    
    fireEvent.press(getByText('Logout'));
    
    // Should show logout confirmation
    expect(getByText('Are you sure you want to logout?')).toBeTruthy();
  });

  it('refreshes wallet data on pull to refresh', async () => {
    const { getByTestId } = render(<MockedHome />);
    
    // Simulate pull to refresh
    const refreshControl = getByTestId('refresh-control');
    fireEvent(refreshControl, 'onRefresh');
    
    await waitFor(() => {
      expect(mockWalletService.refreshBalance).toHaveBeenCalled();
      expect(mockWalletService.loadTransactions).toHaveBeenCalled();
    });
  });

  it('displays balance breakdown', () => {
    const { getByText } = render(<MockedHome />);
    
    expect(getByText('On-chain')).toBeTruthy();
    expect(getByText('Lightning')).toBeTruthy();
    expect(getByText('0.01000000 BTC')).toBeTruthy(); // On-chain
    expect(getByText('0.00500000 BTC')).toBeTruthy(); // Lightning
  });

  it('handles currency conversion display', async () => {
    const { getByText } = render(<MockedHome />);
    
    // Switch to USD
    fireEvent.press(getByText('$'));
    
    await waitFor(() => {
      expect(getByText('≈ $600.00')).toBeTruthy();
      expect(getByText('0.01500000 BTC')).toBeTruthy(); // Secondary BTC display
    });
  });
});
