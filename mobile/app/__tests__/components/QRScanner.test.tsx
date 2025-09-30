import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QRScanner } from '../../components/QRScanner';

// Mock expo-camera
jest.mock('expo-camera', () => ({
  CameraView: ({ onBarcodeScanned, children }: any) => {
    const MockCameraView = ({ children }: any) => {
      // Simulate barcode scan after a short delay
      React.useEffect(() => {
        const timer = setTimeout(() => {
          onBarcodeScanned({
            type: 'qr',
            data: 'lnbc1000u1p3k2v5cpp5test',
          });
        }, 100);
        return () => clearTimeout(timer);
      }, []);
      
      return children;
    };
    return <MockCameraView>{children}</MockCameraView>;
  },
  useCameraPermissions: () => [
    { granted: true },
    jest.fn(),
  ],
}));

// Mock Vibration
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Vibration: {
    vibrate: jest.fn(),
  },
}));

describe('QRScanner Component', () => {
  const mockOnScan = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when visible', () => {
    const { getByText } = render(
      <QRScanner
        visible={true}
        onScan={mockOnScan}
        onClose={mockOnClose}
      />
    );

    expect(getByText('Position the QR code within the frame')).toBeTruthy();
  });

  it('does not render when not visible', () => {
    const { queryByText } = render(
      <QRScanner
        visible={false}
        onScan={mockOnScan}
        onClose={mockOnClose}
      />
    );

    expect(queryByText('Position the QR code within the frame')).toBeNull();
  });

  it('calls onClose when close button is pressed', () => {
    const { getByText } = render(
      <QRScanner
        visible={true}
        onScan={mockOnScan}
        onClose={mockOnClose}
      />
    );

    fireEvent.press(getByText('✕'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('handles QR code scanning', async () => {
    render(
      <QRScanner
        visible={true}
        onScan={mockOnScan}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(mockOnScan).toHaveBeenCalledWith('lnbc1000u1p3k2v5cpp5test');
    });
  });

  it('validates QR code format', async () => {
    // Mock invalid QR code
    jest.doMock('expo-camera', () => ({
      CameraView: ({ onBarcodeScanned, children }: any) => {
        const MockCameraView = ({ children }: any) => {
          React.useEffect(() => {
            const timer = setTimeout(() => {
              onBarcodeScanned({
                type: 'qr',
                data: 'invalid-qr-code',
              });
            }, 100);
            return () => clearTimeout(timer);
          }, []);
          
          return children;
        };
        return <MockCameraView>{children}</MockCameraView>;
      },
      useCameraPermissions: () => [
        { granted: true },
        jest.fn(),
      ],
    }));

    render(
      <QRScanner
        visible={true}
        onScan={mockOnScan}
        onClose={mockOnClose}
      />
    );

    // Wait a bit to ensure the invalid QR code is processed
    await new Promise(resolve => setTimeout(resolve, 200));

    // Should not call onScan for invalid QR codes
    expect(mockOnScan).not.toHaveBeenCalled();
  });

  it('shows processing state when QR code is scanned', async () => {
    const { getByText } = render(
      <QRScanner
        visible={true}
        onScan={mockOnScan}
        onClose={mockOnClose}
      />
    );

    // Initially shows positioning instruction
    expect(getByText('Position the QR code within the frame')).toBeTruthy();

    // After scanning, should show processing state
    await waitFor(() => {
      expect(getByText('Processing QR code...')).toBeTruthy();
    });
  });

  it('prevents rapid scanning', async () => {
    // Mock rapid QR code scans
    jest.doMock('expo-camera', () => ({
      CameraView: ({ onBarcodeScanned, children }: any) => {
        const MockCameraView = ({ children }: any) => {
          React.useEffect(() => {
            // Simulate rapid scans
            const timer1 = setTimeout(() => {
              onBarcodeScanned({
                type: 'qr',
                data: 'lnbc1000u1p3k2v5cpp5test1',
              });
            }, 50);
            
            const timer2 = setTimeout(() => {
              onBarcodeScanned({
                type: 'qr',
                data: 'lnbc1000u1p3k2v5cpp5test2',
              });
            }, 100);
            
            return () => {
              clearTimeout(timer1);
              clearTimeout(timer2);
            };
          }, []);
          
          return children;
        };
        return <MockCameraView>{children}</MockCameraView>;
      },
      useCameraPermissions: () => [
        { granted: true },
        jest.fn(),
      ],
    }));

    render(
      <QRScanner
        visible={true}
        onScan={mockOnScan}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      // Should only call onScan once despite rapid scans
      expect(mockOnScan).toHaveBeenCalledTimes(1);
    });
  });
});
