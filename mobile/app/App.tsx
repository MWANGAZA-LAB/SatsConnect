import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import Onboarding from './screens/Onboarding';
import Home from './screens/Home';
import Send from './screens/Send';
import Receive from './screens/Receive';
import History from './screens/History';
import Airtime from './screens/Airtime';
import BillPayment from './screens/BillPayment';
import { authService } from './services/authService';
import { LoadingSpinner } from './components/LoadingSpinner';
import { theme } from './theme';

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  Send: undefined;
  Receive: undefined;
  History: undefined;
  Airtime: undefined;
  BillPayment: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [authState, setAuthState] = useState(authService.getAuthState());
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = authService.subscribe(setAuthState);

    // Initialize auth and check if user has wallet
    const initializeApp = async () => {
      try {
        // Wait a bit for auth service to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsInitializing(false);
      } catch (error) {
        console.error('App initialization error:', error);
        setIsInitializing(false);
      }
    };

    initializeApp();
    return unsubscribe;
  }, []);

  if (isInitializing) {
    return (
      <LoadingSpinner
        text="Initializing SatsConnect..."
        style={{ backgroundColor: theme.colors.background }}
      />
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" backgroundColor={theme.colors.background} />
      <Stack.Navigator
        initialRouteName={authState.hasWallet ? 'Home' : 'Onboarding'}
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.surface,
          },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="Onboarding"
          component={Onboarding}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Home"
          component={Home}
          options={{
            title: 'SatsConnect',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Send"
          component={Send}
          options={{
            title: 'Send Bitcoin',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="Receive"
          component={Receive}
          options={{
            title: 'Receive Bitcoin',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="History"
          component={History}
          options={{
            title: 'Transaction History',
          }}
        />
        <Stack.Screen
          name="Airtime"
          component={Airtime}
          options={{
            title: 'Buy Airtime',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="BillPayment"
          component={BillPayment}
          options={{
            title: 'Pay Bills',
            presentation: 'modal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
