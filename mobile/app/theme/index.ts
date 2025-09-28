import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

export const theme = {
  colors,
  typography,
  spacing,

  // Common styles
  shadows: {
    small: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    medium: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    large: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    },
  },

  // Border radius
  borderRadius: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 20,
    full: 9999,
  },

  // Common component styles
  components: {
    card: {
      backgroundColor: colors.surface,
      borderRadius: spacing.card.borderRadius,
      padding: spacing.card.padding,
      margin: spacing.card.margin,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    button: {
      borderRadius: spacing.button.borderRadius,
      padding: spacing.button.padding,
      margin: spacing.button.margin,
    },
    input: {
      borderRadius: spacing.input.borderRadius,
      padding: spacing.input.padding,
      margin: spacing.input.margin,
      borderWidth: 1,
      borderColor: colors.border,
    },
  },
};

export type Theme = typeof theme;
export default theme;
