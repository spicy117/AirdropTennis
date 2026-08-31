import React from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions, ScrollView, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { memberColors, memberRadius, memberTypography } from '../../theme/memberTheme';

const DESKTOP_BREAKPOINT = 768;

function BrandCourtLines() {
  return (
    <View style={brandStyles.linesWrap} pointerEvents="none">
      <View style={brandStyles.lineH} />
      <View style={brandStyles.lineV} />
      <View style={brandStyles.arc} />
      <View style={brandStyles.ball} />
    </View>
  );
}

export function AuthBrandPanel({ taglines }) {
  const lines = taglines || ['Your court.', 'Your sessions.', 'Your game.'];

  return (
    <View style={brandStyles.panel}>
      <BrandCourtLines />
      <View style={brandStyles.content}>
        <Text style={brandStyles.logo}>🎾 Airdrop Tennis</Text>
        <View style={brandStyles.taglines}>
          {lines.map((line) => (
            <Text key={line} style={brandStyles.tagline}>{line}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

export function AuthMobileHeader() {
  return (
    <View style={brandStyles.mobileHeader}>
      <Text style={brandStyles.mobileLogo}>🎾 Airdrop Tennis</Text>
      <View style={brandStyles.mobileBall} />
    </View>
  );
}

export default function AuthLayout({
  children,
  desktopBrand = true,
  scrollable = false,
  keyboardAvoid = true,
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  const body = scrollable ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {!isDesktop && <AuthMobileHeader />}
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.authBody, { paddingBottom: insets.bottom + 16 }]}>
      {!isDesktop && <AuthMobileHeader />}
      {children}
    </View>
  );

  const inner = (
    <View style={[styles.shell, isDesktop && styles.shellDesktop]}>
      {isDesktop && desktopBrand && <AuthBrandPanel />}
      <View style={[styles.authColumn, isDesktop && styles.authColumnDesktop]}>
        {body}
      </View>
    </View>
  );

  if (!keyboardAvoid) {
    return <View style={styles.screen}>{inner}</View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {inner}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: memberColors.bg,
    ...(Platform.OS === 'web' && { minHeight: '100vh' }),
  },
  shell: {
    flex: 1,
    width: '100%',
  },
  shellDesktop: {
    flexDirection: 'row',
    maxWidth: 1080,
    alignSelf: 'center',
    width: '100%',
    minHeight: '100vh',
    padding: 32,
    gap: 0,
  },
  authColumn: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  authColumnDesktop: {
    maxWidth: 440,
    paddingHorizontal: 48,
    paddingVertical: 48,
    justifyContent: 'center',
  },
  authBody: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 8,
  },
});

const brandStyles = StyleSheet.create({
  panel: {
    flex: 1,
    maxWidth: 520,
    backgroundColor: memberColors.court,
    borderRadius: memberRadius.xl,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    padding: 48,
  },
  linesWrap: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2,
  },
  lineH: {
    position: 'absolute',
    top: '42%',
    left: '10%',
    right: '8%',
    height: 1,
    backgroundColor: memberColors.white,
  },
  lineV: {
    position: 'absolute',
    top: '18%',
    bottom: '18%',
    left: '58%',
    width: 1,
    backgroundColor: memberColors.white,
  },
  arc: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: memberColors.lime,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    bottom: '12%',
    right: '8%',
    opacity: 0.5,
    transform: [{ rotate: '-20deg' }],
  },
  ball: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: memberColors.lime,
    top: '28%',
    right: '22%',
    opacity: 0.55,
  },
  content: {
    zIndex: 1,
    position: 'relative',
  },
  logo: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: memberColors.white,
    marginBottom: 32,
  },
  taglines: {
    gap: 6,
  },
  tagline: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.8,
    color: memberColors.white,
    lineHeight: 34,
  },
  mobileHeader: {
    alignItems: 'center',
    marginBottom: 28,
    position: 'relative',
  },
  mobileLogo: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: memberColors.ink,
  },
  mobileBall: {
    position: 'absolute',
    right: '18%',
    top: -8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: memberColors.lime,
    opacity: 0.7,
  },
});
