import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { theme } from '../theme';

export interface QRCodeProps {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  style?: ViewStyle;
  logo?: React.ReactNode;
  logoSize?: number;
  logoBackgroundColor?: string;
  logoMargin?: number;
  logoBorderRadius?: number;
}

export const QRCodeComponent: React.FC<QRCodeProps> = ({
  value,
  size = 200,
  color = theme.colors.black,
  backgroundColor = theme.colors.white,
  style,
  logo,
  logoSize = 40,
  logoBackgroundColor = theme.colors.white,
  logoMargin = 2,
  logoBorderRadius = 8,
}) => {
  return (
    <View style={[styles.container, style]}>
      <QRCode
        value={value}
        size={size}
        color={color}
        backgroundColor={backgroundColor}
        logo={logo}
        logoSize={logoSize}
        logoBackgroundColor={logoBackgroundColor}
        logoMargin={logoMargin}
        logoBorderRadius={logoBorderRadius}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
});

export default QRCodeComponent;
