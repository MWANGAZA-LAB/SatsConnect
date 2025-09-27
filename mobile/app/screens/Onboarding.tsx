import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Clipboard,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { theme } from '../theme';
import { walletService } from '../services/walletService';
import { authService } from '../services/authService';

const { width } = Dimensions.get('window');

type OnboardingNavigationProp = StackNavigationProp<RootStackParamList, 'Onboarding'>;

export default function Onboarding() {
  const navigation = useNavigation<OnboardingNavigationProp>();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [confirmedMnemonic, setConfirmedMnemonic] = useState<string[]>([]);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [shuffledWords, setShuffledWords] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(width));

  const steps = [
    'welcome',
    'nonCustodial',
    'seedPhrase',
    'confirmSeed',
    'disclaimer',
    'complete',
  ];

  useEffect(() => {
    if (step === 2) {
      generateMnemonic();
    }
    
    // Update progress
    setProgress((step / (steps.length - 1)) * 100);
    
    // Animate step transitions
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step]);

  const generateMnemonic = () => {
    // In a real app, use a proper BIP39 mnemonic generator
    const words = [
      'abandon', 'ability', 'able', 'about', 'above', 'absent',
      'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident',
      'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire',
      'across', 'act', 'action', 'actor', 'actress', 'actual',
    ];
    
    const generatedMnemonic = Array.from({ length: 12 }, () => 
      words[Math.floor(Math.random() * words.length)]
    );
    
    setMnemonic(generatedMnemonic);
    setShuffledWords([...generatedMnemonic].sort(() => Math.random() - 0.5));
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      completeOnboarding();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleWordSelect = (word: string) => {
    if (selectedWords.includes(word)) return;
    
    const newSelected = [...selectedWords, word];
    setSelectedWords(newSelected);
    
    if (newSelected.length === mnemonic.length) {
      setConfirmedMnemonic(newSelected);
    }
  };

  const handleWordRemove = (index: number) => {
    const newSelected = selectedWords.filter((_, i) => i !== index);
    setSelectedWords(newSelected);
    setConfirmedMnemonic([]);
  };

  const copyMnemonic = async () => {
    try {
      await Clipboard.setString(mnemonic.join(' '));
      Alert.alert('Copied', 'Seed phrase copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy seed phrase');
    }
  };

  const completeOnboarding = async () => {
    try {
      setIsLoading(true);
      
      // Create wallet with generated mnemonic
      const success = await walletService.createWallet(
        'My SatsConnect Wallet',
        mnemonic.join(' ')
      );
      
      if (success) {
        navigation.replace('Home');
      } else {
        Alert.alert('Error', 'Failed to create wallet. Please try again.');
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      Alert.alert('Error', 'Failed to complete onboarding');
    } finally {
      setIsLoading(false);
    }
  };

  const renderWelcome = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Welcome to SatsConnect</Text>
      <Text style={styles.subtitle}>
        Your secure, non-custodial Bitcoin Lightning wallet
      </Text>
      <Card style={styles.featureCard}>
        <Text style={styles.featureTitle}>⚡ Lightning Fast</Text>
        <Text style={styles.featureText}>
          Send and receive Bitcoin instantly with Lightning Network
        </Text>
      </Card>
      <Card style={styles.featureCard}>
        <Text style={styles.featureTitle}>🔒 Non-Custodial</Text>
        <Text style={styles.featureText}>
          You control your keys. We never have access to your funds.
        </Text>
      </Card>
      <Card style={styles.featureCard}>
        <Text style={styles.featureTitle}>🇰🇪 Made for Africa</Text>
        <Text style={styles.featureText}>
          Buy airtime, pay bills, and send money across Kenya
        </Text>
      </Card>
    </View>
  );

  const renderNonCustodial = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>You Control Your Money</Text>
      <Text style={styles.subtitle}>
        SatsConnect is a non-custodial wallet. This means:
      </Text>
      
      <View style={styles.infoList}>
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>🔑</Text>
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>You own your private keys</Text>
            <Text style={styles.infoDescription}>
              Only you can access your funds. We never store your keys.
            </Text>
          </View>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>💪</Text>
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Full control</Text>
            <Text style={styles.infoDescription}>
              You can restore your wallet on any device using your seed phrase.
            </Text>
          </View>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>⚠️</Text>
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Your responsibility</Text>
            <Text style={styles.infoDescription}>
              If you lose your seed phrase, you lose access to your funds forever.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderSeedPhrase = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Your Recovery Phrase</Text>
      <Text style={styles.subtitle}>
        Write down these 12 words in order. This is your backup.
      </Text>
      
      <Card style={styles.seedCard}>
        <View style={styles.seedGrid}>
          {mnemonic.map((word, index) => (
            <View key={index} style={styles.seedWord}>
              <Text style={styles.seedNumber}>{index + 1}</Text>
              <Text style={styles.seedText}>{word}</Text>
            </View>
          ))}
        </View>
        
        <TouchableOpacity style={styles.copyButton} onPress={copyMnemonic}>
          <Text style={styles.copyButtonText}>📋 Copy to Clipboard</Text>
        </TouchableOpacity>
      </Card>
      
      <Text style={styles.warningText}>
        ⚠️ Never share your seed phrase with anyone. Store it safely offline.
      </Text>
    </View>
  );

  const renderConfirmSeed = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Confirm Your Seed Phrase</Text>
      <Text style={styles.subtitle}>
        Tap the words in the correct order to confirm you've saved them.
      </Text>
      
      <Card style={styles.confirmCard}>
        <View style={styles.selectedWords}>
          {selectedWords.map((word, index) => (
            <TouchableOpacity
              key={index}
              style={styles.selectedWord}
              onPress={() => handleWordRemove(index)}
            >
              <Text style={styles.selectedWordText}>{word}</Text>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={styles.wordOptions}>
          {shuffledWords
            .filter(word => !selectedWords.includes(word))
            .map((word, index) => (
              <TouchableOpacity
                key={index}
                style={styles.wordOption}
                onPress={() => handleWordSelect(word)}
              >
                <Text style={styles.wordOptionText}>{word}</Text>
              </TouchableOpacity>
            ))}
        </View>
      </Card>
    </View>
  );

  const renderDisclaimer = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Important Disclaimer</Text>
      
      <Card style={styles.disclaimerCard}>
        <Text style={styles.disclaimerTitle}>⚠️ You are responsible for your funds</Text>
        <Text style={styles.disclaimerText}>
          • If you lose your seed phrase, you lose access to your funds forever{'\n'}
          • Bitcoin transactions are irreversible{'\n'}
          • Always verify addresses before sending{'\n'}
          • Keep your seed phrase safe and offline{'\n'}
          • This is experimental software - use at your own risk
        </Text>
      </Card>
      
      <Text style={styles.agreementText}>
        By continuing, you agree to these terms and understand the risks.
      </Text>
    </View>
  );

  const renderComplete = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>🎉 You're All Set!</Text>
      <Text style={styles.subtitle}>
        Your wallet has been created successfully. You can now start using SatsConnect.
      </Text>
      
      <Card style={styles.completeCard}>
        <Text style={styles.completeIcon}>✅</Text>
        <Text style={styles.completeText}>
          Wallet created and secured
        </Text>
      </Card>
    </View>
  );

  const renderStep = () => {
    switch (steps[step]) {
      case 'welcome':
        return renderWelcome();
      case 'nonCustodial':
        return renderNonCustodial();
      case 'seedPhrase':
        return renderSeedPhrase();
      case 'confirmSeed':
        return renderConfirmSeed();
      case 'disclaimer':
        return renderDisclaimer();
      case 'complete':
        return renderComplete();
      default:
        return renderWelcome();
    }
  };

  const canProceed = () => {
    switch (steps[step]) {
      case 'confirmSeed':
        return confirmedMnemonic.length === mnemonic.length;
      default:
        return true;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner text="Creating your wallet..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollView>
      
      <View style={styles.footer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${((step + 1) / steps.length) * 100}%` }
            ]} 
          />
        </View>
        
        <View style={styles.buttonRow}>
          {step > 0 && (
            <Button
              title="Back"
              onPress={handleBack}
              variant="outline"
              style={styles.backButton}
            />
          )}
          
          <Button
            title={step === steps.length - 1 ? 'Get Started' : 'Next'}
            onPress={handleNext}
            disabled={!canProceed()}
            style={styles.nextButton}
          />
        </View>
      </View>
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
  stepContainer: {
    flex: 1,
    padding: theme.spacing.screen.padding,
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.textStyles.h1,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  subtitle: {
    ...theme.typography.textStyles.body1,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  featureCard: {
    marginBottom: theme.spacing.md,
  },
  featureTitle: {
    ...theme.typography.textStyles.h5,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  featureText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textSecondary,
  },
  infoList: {
    marginTop: theme.spacing.lg,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.lg,
  },
  infoIcon: {
    fontSize: 24,
    marginRight: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    ...theme.typography.textStyles.h6,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  infoDescription: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textSecondary,
  },
  seedCard: {
    marginBottom: theme.spacing.lg,
  },
  seedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  seedWord: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.sm,
    borderRadius: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  seedNumber: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.sm,
    minWidth: 20,
  },
  seedText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  copyButton: {
    backgroundColor: theme.colors.gray100,
    padding: theme.spacing.sm,
    borderRadius: theme.spacing.sm,
    alignItems: 'center',
  },
  copyButtonText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textPrimary,
  },
  warningText: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.warning,
    textAlign: 'center',
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.sm,
    borderRadius: theme.spacing.sm,
  },
  confirmCard: {
    marginBottom: theme.spacing.lg,
  },
  selectedWords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.md,
    minHeight: 60,
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.sm,
    borderRadius: theme.spacing.sm,
  },
  selectedWord: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.spacing.sm,
    margin: theme.spacing.xs,
  },
  selectedWordText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.white,
    marginRight: theme.spacing.xs,
  },
  removeText: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.white,
  },
  wordOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  wordOption: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.spacing.sm,
    margin: theme.spacing.xs,
  },
  wordOptionText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textPrimary,
  },
  disclaimerCard: {
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.error + '10',
    borderColor: theme.colors.error,
    borderWidth: 1,
  },
  disclaimerTitle: {
    ...theme.typography.textStyles.h6,
    color: theme.colors.error,
    marginBottom: theme.spacing.sm,
  },
  disclaimerText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  agreementText: {
    ...theme.typography.textStyles.body2,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  completeCard: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  completeIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  completeText: {
    ...theme.typography.textStyles.h6,
    color: theme.colors.success,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  footer: {
    padding: theme.spacing.screen.padding,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.gray200,
    borderRadius: 2,
    marginBottom: theme.spacing.lg,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
});