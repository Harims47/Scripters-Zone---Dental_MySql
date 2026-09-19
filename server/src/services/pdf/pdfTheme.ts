/**
 * Production PDF Design System Theme & Style Tokens
 * Standardizes colors, typography, page dimensions, and spacing across all DentalCore PDFs.
 */

export const PDF_THEME = {
  // Page specs (A4 standard points: 72 points per inch)
  pageSize: {
    portrait: { width: 595.28, height: 841.89 },
    landscape: { width: 841.89, height: 595.28 }
  },
  
  // Margins
  margins: {
    standard: 40,
    compact: 32,
    borderInset: 12
  },

  // Color Palette
  colors: {
    primaryNavy: '#1E3A8A',    // Main brand navy
    primaryTeal: '#0F766E',    // Dental teal accent
    textDark: '#0F172A',       // Slate 900
    textMuted: '#475569',      // Slate 600
    textLight: '#94A3B8',      // Slate 400
    border: '#CBD5E1',         // Slate 300
    borderLight: '#E2E8F0',    // Slate 200
    bgLight: '#F8FAFC',        // Slate 50
    bgWhite: '#FFFFFF',
    
    // Status badges
    statusPaid: '#15803D',
    statusPaidBg: '#DCFCE7',
    statusPartial: '#B45309',
    statusPartialBg: '#FEF3C7',
    statusUnpaid: '#B91C1C',
    statusUnpaidBg: '#FEE2E2',
    
    // Accent tints
    headerBg: '#F0FDFA',
    divider: '#0D9488'
  },

  // Font family names registered in PDFKit
  fonts: {
    regular: 'Roboto',
    bold: 'Roboto-Bold',
    tamilRegular: 'Tamil',
    tamilBold: 'Tamil-Bold'
  }
};
