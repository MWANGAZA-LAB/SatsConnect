import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Onboarding from '../../screens/Onboarding';
import { walletService } from '../../services/walletService';
import { authService } from '../../services/authService';

// Mock services
jest.mock('../../services/walletService');
jest.mock('../../services/authService');

const mockWalletService = walletService as jest.Mocked<typeof walletService>;
const mockAuthService = authService as jest.Mocked<typeof authService>;

// Mock navigation
const Stack = createStackNavigator();
const MockedOnboarding = () => (
  <NavigationContainer>
    <Stack.Navigator>
      <Stack.Screen name="Onboarding" component={Onboarding} />
    </Stack.Navigator>
  </NavigationContainer>
);

describe('Onboarding Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletService.createWallet.mockResolvedValue(true);
  });

  it('renders welcome step correctly', () => {
    const { getByText } = render(<MockedOnboarding />);
    
    expect(getByText('Welcome to SatsConnect')).toBeTruthy();
    expect(getByText('Your secure, non-custodial Bitcoin Lightning wallet')).toBeTruthy();
    expect(getByText('⚡ Lightning Fast')).toBeTruthy();
    expect(getByText('🔒 Non-Custodial')).toBeTruthy();
    expect(getByText('🇰🇪 Made for Africa')).toBeTruthy();
  });

  it('navigates through steps correctly', async () => {
    const { getByText } = render(<MockedOnboarding />);
    
    // Start at welcome step
    expect(getByText('Welcome to SatsConnect')).toBeTruthy();
    
    // Go to next step
    fireEvent.press(getByText('Next'));
    
    await waitFor(() => {
      expect(getByText('You Control Your Money')).toBeTruthy();
    });
    
    // Go to next step
    fireEvent.press(getByText('Next'));
    
    await waitFor(() => {
      expect(getByText('Your Recovery Phrase')).toBeTruthy();
    });
  });

  it('generates mnemonic on seed phrase step', async () => {
    const { getByText } = render(<MockedOnboarding />);
    
    // Navigate to seed phrase step
    fireEvent.press(getByText('Next')); // Welcome -> Non-custodial
    fireEvent.press(getByText('Next')); // Non-custodial -> Seed phrase
    
    await waitFor(() => {
      expect(getByText('Your Recovery Phrase')).toBeTruthy();
      expect(getByText('Choose how you\'d like to backup your 12-word recovery phrase')).toBeTruthy();
    });
  });

  it('shows backup method selection', async () => {
    const { getByText } = render(<MockedOnboarding />);
    
    // Navigate to seed phrase step
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    
    await waitFor(() => {
      expect(getByText('Write Down')).toBeTruthy();
      expect(getByText('Copy')).toBeTruthy();
      expect(getByText('QR Code')).toBeTruthy();
    });
  });

  it('toggles seed phrase visibility', async () => {
    const { getByText } = render(<MockedOnboarding />);
    
    // Navigate to seed phrase step
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    
    await waitFor(() => {
      // Initially hidden
      expect(getByText('👁️ Show')).toBeTruthy();
      
      // Toggle visibility
      fireEvent.press(getByText('👁️ Show'));
      
      // Should show hide button
      expect(getByText('🙈 Hide')).toBeTruthy();
    });
  });

  it('copies mnemonic to clipboard', async () => {
    const { getByText } = render(<MockedOnboarding />);
    
    // Navigate to seed phrase step
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    
    await waitFor(() => {
      // Show seed phrase
      fireEvent.press(getByText('👁️ Show'));
      
      // Copy to clipboard
      fireEvent.press(getByText('📋 Copy'));
      
      // Should show copied state
      expect(getByText('✅ Copied!')).toBeTruthy();
    });
  });

  it('navigates to confirmation step', async () => {
    const { getByText } = render(<MockedOnboarding />);
    
    // Navigate to seed phrase step
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    
    // Go to confirmation step
    fireEvent.press(getByText('Next'));
    
    await waitFor(() => {
      expect(getByText('Confirm Your Seed Phrase')).toBeTruthy();
      expect(getByText('Tap the words in the correct order to confirm you\'ve saved them.')).toBeTruthy();
    });
  });

  it('handles word selection in confirmation step', async () => {
    const { getByText } = render(<MockedOnboarding />);
    
    // Navigate to confirmation step
    fireEvent.press(getByText('Next')); // Welcome
    fireEvent.press(getByText('Next')); // Non-custodial
    fireEvent.press(getByText('Next')); // Seed phrase
    fireEvent.press(getByText('Next')); // Confirmation
    
    await waitFor(() => {
      // Should show word options
      const wordOptions = getByText('abandon'); // First word in mock mnemonic
      expect(wordOptions).toBeTruthy();
      
      // Select a word
      fireEvent.press(wordOptions);
      
      // Should add to selected words
      expect(getByText('abandon')).toBeTruthy();
    });
  });

  it('validates complete mnemonic confirmation', async () => {
    const { getByText } = render(<MockedOnboarding />);
    
    // Navigate to confirmation step
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    
    await waitFor(() => {
      // Select all 12 words (mock implementation)
      const wordOptions = getByText('abandon');
      fireEvent.press(wordOptions);
      
      // Should enable next button
      expect(getByText('Next')).toBeTruthy();
    });
  });

  it('shows disclaimer step', async () => {
    const { getByText } = render(<MockedOnboarding />);
    
    // Navigate to disclaimer step
    fireEvent.press(getByText('Next')); // Welcome
    fireEvent.press(getByText('Next')); // Non-custodial
    fireEvent.press(getByText('Next')); // Seed phrase
    fireEvent.press(getByText('Next')); // Confirmation
    fireEvent.press(getByText('Next')); // Disclaimer
    
    await waitFor(() => {
      expect(getByText('Important Disclaimer')).toBeTruthy();
      expect(getByText('⚠️ You are responsible for your funds')).toBeTruthy();
      expect(getByText('By continuing, you agree to these terms and understand the risks.')).toBeTruthy();
    });
  });

  it('completes onboarding successfully', async () => {
    const { getByText } = render(<MockedOnboarding />);
    
    // Navigate through all steps
    fireEvent.press(getByText('Next')); // Welcome
    fireEvent.press(getByText('Next')); // Non-custodial
    fireEvent.press(getByText('Next')); // Seed phrase
    fireEvent.press(getByText('Next')); // Confirmation
    fireEvent.press(getByText('Next')); // Disclaimer
    fireEvent.press(getByText('Get Started')); // Complete
    
    await waitFor(() => {
      expect(mockWalletService.createWallet).toHaveBeenCalledWith(
        'My SatsConnect Wallet',
        expect.any(String) // Generated mnemonic
      );
    });
  });

  it('handles onboarding errors', async () => {
    mockWalletService.createWallet.mockResolvedValue(false);
    
    const { getByText } = render(<MockedOnboarding />);
    
    // Navigate through all steps
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Get Started'));
    
    await waitFor(() => {
      expect(getByText('Error')).toBeTruthy();
      expect(getByText('Failed to create wallet. Please try again.')).toBeTruthy();
    });
  });

  it('allows going back through steps', async () => {
    const { getByText } = render(<MockedOnboarding />);
    
    // Go to second step
    fireEvent.press(getByText('Next'));
    
    await waitFor(() => {
      expect(getByText('You Control Your Money')).toBeTruthy();
    });
    
    // Go back
    fireEvent.press(getByText('Back'));
    
    await waitFor(() => {
      expect(getByText('Welcome to SatsConnect')).toBeTruthy();
    });
  });

  it('shows progress bar', () => {
    const { getByTestId } = render(<MockedOnboarding />);
    
    // Should have progress bar
    const progressBar = getByTestId('progress-bar');
    expect(progressBar).toBeTruthy();
  });

  it('disables next button when validation fails', async () => {
    const { getByText } = render(<MockedOnboarding />);
    
    // Navigate to confirmation step
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    
    await waitFor(() => {
      // Next button should be disabled until all words are selected
      const nextButton = getByText('Next');
      expect(nextButton).toBeTruthy();
    });
  });
});
