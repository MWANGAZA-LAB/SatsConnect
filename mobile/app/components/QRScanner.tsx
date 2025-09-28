import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Dimensions,
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

  const handleBarCodeScanned = ({
    type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    if (scanned) return;

    setScanned(true);
    onScan(data);

    // Reset scanned state after 2 seconds
    setTimeout(() => {
      setScanned(false);
    }, 2000);
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
              <View style={styles.scanFrame} />
            </View>
            <View style={styles.sideOverlay} />
          </View>
          <View style={styles.bottomOverlay} />
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.instructions}>
            <Text style={styles.instructionText}>
              Position the QR code within the frame
            </Text>
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
