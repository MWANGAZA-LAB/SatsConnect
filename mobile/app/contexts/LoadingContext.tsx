import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { theme } from '../theme';

interface LoadingState {
  visible: boolean;
  message?: string;
  overlay?: boolean;
}

interface LoadingContextType {
  showLoading: (message?: string, overlay?: boolean) => void;
  hideLoading: () => void;
  isLoading: boolean;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    visible: false,
    message: 'Loading...',
    overlay: false,
  });

  const showLoading = useCallback((message = 'Loading...', overlay = false) => {
    setLoadingState({
      visible: true,
      message,
      overlay,
    });
  }, []);

  const hideLoading = useCallback(() => {
    setLoadingState(prev => ({ ...prev, visible: false }));
  }, []);

  return (
    <LoadingContext.Provider
      value={{
        showLoading,
        hideLoading,
        isLoading: loadingState.visible,
      }}
    >
      {children}
      {loadingState.visible && (
        <View style={[
          styles.container,
          loadingState.overlay && styles.overlay
        ]}>
          <LoadingSpinner text={loadingState.message} />
        </View>
      )}
    </LoadingContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});
