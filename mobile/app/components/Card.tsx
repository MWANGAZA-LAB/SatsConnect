import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padding?: keyof typeof theme.spacing.padding;
  margin?: keyof typeof theme.spacing.margin;
  shadow?: 'small' | 'medium' | 'large';
  borderRadius?: keyof typeof theme.borderRadius;
  backgroundColor?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  style,
  padding = 'md',
  margin = 'sm',
  shadow = 'small',
  borderRadius = 'lg',
  backgroundColor = theme.colors.surface,
}) => {
  const cardStyle = [
    styles.base,
    {
      padding: theme.spacing.padding[padding],
      margin: theme.spacing.margin[margin],
      borderRadius: theme.borderRadius[borderRadius],
      backgroundColor,
    },
    theme.shadows[shadow],
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    // Base card styles are applied via props
  },
});

export default Card;
