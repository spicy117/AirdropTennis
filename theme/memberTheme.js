import { Platform } from 'react-native';

/** Airdrop Tennis member experience design tokens */
export const memberColors = {
  lime: '#D4F934',
  limeMuted: 'rgba(212, 249, 52, 0.18)',
  limeSoft: 'rgba(212, 249, 52, 0.08)',
  court: '#1E3D32',
  courtMuted: 'rgba(30, 61, 50, 0.08)',
  bg: '#F6F4EF',
  bgDeep: '#EDEAE3',
  surface: '#FDFCFA',
  surfaceRaised: '#FFFFFF',
  ink: '#141414',
  inkSecondary: '#4A4A4A',
  inkMuted: '#8A8680',
  inkFaint: '#B8B4AC',
  border: 'rgba(20, 20, 20, 0.08)',
  borderStrong: 'rgba(20, 20, 20, 0.14)',
  danger: '#DC2626',
  dangerSoft: 'rgba(220, 38, 38, 0.1)',
  white: '#FFFFFF',
};

export const memberSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const memberRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
};

export const memberTypography = {
  hero: { fontSize: 34, fontWeight: '700', letterSpacing: -1.2, color: memberColors.ink },
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8, color: memberColors.ink },
  h2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: memberColors.ink },
  h3: { fontSize: 18, fontWeight: '600', letterSpacing: -0.3, color: memberColors.ink },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24, color: memberColors.inkSecondary },
  bodyStrong: { fontSize: 16, fontWeight: '600', color: memberColors.ink },
  caption: { fontSize: 13, fontWeight: '500', color: memberColors.inkMuted },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, color: memberColors.inkMuted },
  stat: { fontSize: 32, fontWeight: '700', letterSpacing: -1, color: memberColors.ink },
  statSm: { fontSize: 24, fontWeight: '700', letterSpacing: -0.6, color: memberColors.ink },
};

export const memberShadow = {
  sm: Platform.select({
    web: { boxShadow: '0 1px 3px rgba(20, 20, 20, 0.06)' },
    default: {
      shadowColor: '#141414',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
  }),
  md: Platform.select({
    web: { boxShadow: '0 8px 24px rgba(20, 20, 20, 0.08)' },
    default: {
      shadowColor: '#141414',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 6,
    },
  }),
  hero: Platform.select({
    web: { boxShadow: '0 16px 40px rgba(20, 20, 20, 0.1)' },
    default: {
      shadowColor: '#141414',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.1,
      shadowRadius: 32,
      elevation: 8,
    },
  }),
};

export const memberMotion = {
  fast: 140,
  normal: 180,
  slow: 300,
};

export const memberPress = {
  scale: 0.98,
  scaleSubtle: 0.99,
};

/** Web-only transition shorthand for hover/focus polish */
export const memberWebTransition = (props = 'all') =>
  Platform.select({
    web: { transition: `${props} ${memberMotion.normal}ms ease` },
    default: {},
  });

/** Respect OS reduced-motion preference (web) */
export const prefersReducedMotion = () =>
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

export const memberBreakpoints = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
};

export const isMemberStudent = (role) =>
  role === 'student' || role == null || (role !== 'admin' && role !== 'coach');
