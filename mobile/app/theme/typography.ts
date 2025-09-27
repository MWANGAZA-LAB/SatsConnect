export const typography = {
  // Font families
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
    light: 'System',
  },
  
  // Font sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
    '6xl': 60,
  },
  
  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
    loose: 1.8,
  },
  
  // Font weights
  fontWeight: {
    light: '300' as const,
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  
  // Text styles
  textStyles: {
    h1: {
      fontSize: 36,
      fontWeight: '700' as const,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: 30,
      fontWeight: '600' as const,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: 24,
      fontWeight: '600' as const,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: 20,
      fontWeight: '500' as const,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: 18,
      fontWeight: '500' as const,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: 16,
      fontWeight: '500' as const,
      lineHeight: 1.4,
    },
    body1: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 1.5,
    },
    body2: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 1.5,
    },
    caption: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 1.4,
    },
    button: {
      fontSize: 16,
      fontWeight: '500' as const,
      lineHeight: 1.4,
    },
    overline: {
      fontSize: 12,
      fontWeight: '500' as const,
      lineHeight: 1.4,
      textTransform: 'uppercase' as const,
    },
  },
};
