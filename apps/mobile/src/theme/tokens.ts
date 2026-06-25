/**
 * Nara Design System Tokens
 * Source: Nara Design System.dc.html
 * Authoritative for all design decisions in the mobile app.
 */

export const colors = {
  // Surfaces & Ink
  paper: '#F3F3F1',        // Background, all screens
  card: '#FFFFFF',         // Cards, bubbles, overlays
  ink: '#18191B',          // Primary text, buttons, record circle
  lockscreen: '#121316',   // Dark background for nudges overlay

  // Text hierarchy
  body: '#26282B',         // Note body text
  secondary: '#6A6E73',    // Back chevrons, "Notes" label, subtitles
  subInk: '#4D5560',       // Note-detail context box text
  faint: '#9A9DA1',        // Metadata, timestamps, disabled
  inactive: '#A8ABAE',     // Disabled state fallback

  // Accent
  accent: '#2E50E6',       // Cobalt — interactive, Nara voice, attention
  waveform: '#4E6EF0',     // Lifted cobalt for listening waveform (higher contrast on ink)

  // Categories (matched to backend category names)
  category: {
    work: {
      base: '#2E50E6',     // Cobalt
      tint: '#E4E9FD',     // Soft fill for avatars, tone pills
    },
    person: {
      base: '#1B9C77',     // Teal
      tint: '#D7F0E7',
    },
    family: {
      base: '#D24E6E',     // Rose
      tint: '#F8E2E8',
    },
    books: {
      base: '#C0892E',     // Gold
      tint: '#F4E9D3',
    },
  },

  // Borders
  border: {
    card: 'rgba(20,22,24,0.07)',        // Hairline on white
    interactive: 'rgba(20,22,24,0.12)', // Slightly heavier for active states
  },

  // Shadows
  shadow: {
    card: 'rgba(20,22,24,0.05)',        // Subtle elevation
    recordBtn: 'rgba(24,25,27,0.3)',    // Heavier on record circle
    lockCard: 'rgba(0,0,0,0.4)',        // Dark context shadow
  },
} as const;

export const radius = {
  pill: 999,       // Filter chips, tone pills, input, buttons
  person: 16,      // Person cards, processing mark
  avatar: 14,      // Person avatars (rounded square)
  card: 14,        // Note cards, CTA buttons
  mark: 7,         // Nara mark square
  dot: 2,          // Category markers (rounded square, NOT circle — essential detail)
  circle: 9999,    // Record button, cobalt dot in mark, chat send
} as const;

export const typography = {
  display: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.9,
    lineHeight: 1.08,
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 1.15,
  },
  body: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 1.45,
  },
  voice: {
    fontSize: 15.5,
    fontWeight: '400',
    fontStyle: 'italic',
    letterSpacing: 0,
    lineHeight: 1.5,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    lineHeight: 1.3,
    textTransform: 'uppercase',
  },
  meta: {
    fontSize: 11.5,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 1.3,
  },
  eyebrow: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    lineHeight: 1.3,
    textTransform: 'uppercase',
  },
} as const;

export const spacing = {
  xs: 4,        // Dot-to-label gap
  sm: 8,        // Meta row gaps
  md: 10,       // Card stack gap
  lg: 16,       // Card padding (horizontal)
  xl: 24,       // Screen horizontal padding
  xxl: 36,      // Between major blocks
  xxxl: 46,     // Max between blocks
  statusBar: 60,     // Top padding (clears iOS status bar)
  tabBar: 122,       // Bottom padding (clears tab bar + safe area)
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  recordBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 34,
    elevation: 16,
  },
  lockCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

/**
 * Get category color by name (case-insensitive).
 * Falls back to a deterministic extended palette if category not in canonical four.
 */
export function getCategoryColor(
  categoryName: string | null | undefined,
  type: 'base' | 'tint' = 'base'
): string {
  if (!categoryName) return colors.faint;

  const normalized = categoryName.toLowerCase();

  // Check canonical categories
  if (normalized in colors.category) {
    return colors.category[normalized as keyof typeof colors.category][type];
  }

  // Extended palette: deterministic hashing for new categories
  const hash = normalized.split('').reduce((h, c) => h + c.charCodeAt(0), 0);
  const extendedPalette = [
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#06B6D4', // Cyan
    '#6366F1', // Indigo
  ];

  return extendedPalette[hash % extendedPalette.length];
}

/**
 * Font family name — Schibsted Grotesk.
 * Must be loaded via expo-font before use in Text components.
 */
export const fontFamily = {
  grotesk: 'SchibstedGrotesk',
} as const;
