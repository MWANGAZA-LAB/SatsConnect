import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
  Vibration,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { theme } from '../theme';

export interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  visible: boolean;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  onScan,
  onClose,
  visible,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [lastScanTime, setLastScanTime] = useState(0);
  
  // Animation refs
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Start scanning animation
  useEffect(() => {
    if (visible && !scanned) {
      const startScanning = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(scanLineAnim, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(scanLineAnim, {
              toValue: 0,
              duration: 2000,
              useNativeDriver: true,
            }),
          ])
        ).start();

        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };

      startScanning();
    }
  }, [visible, scanned, scanLineAnim, pulseAnim]);

  const handleBarCodeScanned = useCallback(({
    type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    const now = Date.now();
    
    // Prevent rapid scanning
    if (scanned || isProcessing || (now - lastScanTime) < 1000) {
      return;
    }

    // Validate QR code format
    if (!isValidQRCode(data)) {
      return;
    }

    setScanned(true);
    setIsProcessing(true);
    setLastScanTime(now);
    setScanCount(prev => prev + 1);

    // Haptic feedback
    Vibration.vibrate(100);

    // Process the scan
    setTimeout(() => {
      onScan(data);
      setIsProcessing(false);
      
      // Reset after processing
      setTimeout(() => {
        setScanned(false);
      }, 2000);
    }, 500);
  }, [scanned, isProcessing, lastScanTime, onScan]);

  const isValidQRCode = (data: string): boolean => {
    // Basic validation for Lightning invoices and Bitcoin addresses
    return (
      data.startsWith('lnbc') || // Lightning invoice
      data.startsWith('bitcoin:') || // Bitcoin URI
      data.startsWith('1') || // Legacy Bitcoin address
      data.startsWith('3') || // P2SH Bitcoin address
      data.startsWith('bc1') || // Bech32 Bitcoin address
      data.startsWith('tb1') || // Testnet Bech32 address
      data.length > 10 // Generic QR code
    );
  };

  if (!visible) {
    return null;
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>No access to camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Request Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <View style={styles.topOverlay} />
          <View style={styles.middleRow}>
            <View style={styles.sideOverlay} />
            <View style={styles.scanArea}>
              <Animated.View 
                style={[
                  styles.scanFrame,
                  { transform: [{ scale: pulseAnim }] }
                ]}
              >
                {/* Corner indicators */}
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
                
                {/* Scanning line */}
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      transform: [
                        {
                          translateY: scanLineAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, scanAreaSize - 40],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </Animated.View>
            </View>
            <View style={styles.sideOverlay} />
          </View>
          <View style={styles.bottomOverlay} />
        </View>

        <View style={styles.controls}>
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            
            {scanCount > 0 && (
              <View style={styles.scanCount}>
                <Text style={styles.scanCountText}>Scans: {scanCount}</Text>
              </View>
            )}
          </View>

          <View style={styles.instructions}>
            <Text style={styles.instructionText}>
              {isProcessing 
                ? 'Processing QR code...' 
                : scanned 
                  ? 'QR code detected!' 
                  : 'Position the QR code within the frame'
              }
            </Text>
            
            {!scanned && (
              <Text style={styles.instructionSubtext}>
                Supports Lightning invoices, Bitcoin addresses, and more
              </Text>
            )}
          </View>
        </View>
      </CameraView>
    </View>
  );
};

const { width, height } = Dimensions.get('window');
const scanAreaSize = width * 0.7;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.black,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  middleRow: {
    flexDirection: 'row',
    height: scanAreaSize,
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scanArea: {
    width: scanAreaSize,
    height: scanAreaSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: scanAreaSize - 40,
    height: scanAreaSize - 40,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: 8,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: theme.colors.primary,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  controls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scanCount: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.spacing.sm,
  },
  scanCountText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
  },
  closeButton: {
    alignSelf: 'flex-end',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: theme.colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  instructions: {
    alignItems: 'center',
  },
  instructionText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: theme.spacing.sm,
    borderRadius: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  instructionSubtext: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
    opacity: 0.8,
  },
  message: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.lg,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.spacing.sm,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: '500',
  },
});

export default QRScanner;
