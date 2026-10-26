/**
 * Provisional brand tokens from Spec 01 ("Brand system"). Contrast notes:
 * Primary Red is for fills, large text and icons; body text uses High-Viz White.
 */
export const colors = {
  red: '#E63946',
  blue: '#1FA2FF', // platonic intent
  lilac: '#BC4AFE', // "both" intent
  pink: '#FF5FA2', // romantic intent
  bg: '#0B0D17',
  surface: '#161A2B',
  border: '#2A3050',
  text: '#F5F7FA',
  muted: '#9AA3BF',
  good: '#3DDC97',
  warn: '#FFB020',
} as const;

export const fonts = {
  display: 'BebasNeue_400Regular',
} as const;

export const space = (n: number) => n * 8;
