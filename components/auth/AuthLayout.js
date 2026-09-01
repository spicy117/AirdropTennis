import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { memberColors, memberTypography, memberBreakpoints } from '../../theme/memberTheme';

const TABLET_BREAKPOINT = memberBreakpoints.tablet;
const DESKTOP_BREAKPOINT = memberBreakpoints.desktop;

/** Single baseline + lime point — restrained, almost invisible */
function BrandAccent() {
  return (
    <View style={accentStyles.wrap} pointerEvents="none">
      <View style={accentStyles.line} />
      <View style={accentStyles.dot} />
    </View>
  );
}

export function AuthPageHeader({ headerRight }) {
  return (
    <View style={headerStyles.row}>
      <Text style={headerStyles.wordmark}>Airdrop Tennis</Text>
      {headerRight ? <View style={headerStyles.right}>{headerRight}</View> : null}
    </View>
  );
}

function DesktopBrandField() {
  return (
    <View style={brandStyles.field} pointerEvents="none">
      <BrandAccent />
      <View style={brandStyles.copy}>
        <Text style={brandStyles.editorial}>Back on court.</Text>
      </View>
    </View>
  );
}

function MobileBrandAccent() {
  return (
    <View style={mobileStyles.wrap}>
      <View style={mobileStyles.bar} />
      <View style={mobileStyles.dot} />
    </View>
  );
}

export default function AuthLayout({
  children,
  scrollable = false,
  keyboardAvoid = true,
  headerRight = null,
  showBrandField = true,
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTabletUp = Platform.OS === 'web' && width >= TABLET_BREAKPOINT;
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  const formContent = (
    <View
      style={[
        styles.formInner,
        isDesktop && styles.formInnerDesktop,
        !isTabletUp && { paddingBottom: insets.bottom + 20 },
      ]}
    >
      {!isDesktop && showBrandField && <MobileBrandAccent />}
      {children}
    </View>
  );

  const body = scrollable ? (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + 24 },
        isDesktop && styles.scrollContentDesktop,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {formContent}
    </ScrollView>
  ) : (
    formContent
  );

  const page = (
    <View style={[styles.page, { paddingTop: insets.top + (isDesktop ? 28 : 16) }]}>
      {isDesktop && showBrandField && <DesktopBrandField />}

      <View style={[styles.contentGrid, isDesktop && styles.contentGridDesktop]}>
        <AuthPageHeader headerRight={headerRight} />

        <View style={[styles.main, isDesktop && styles.mainDesktop]}>
          <View style={[styles.formColumn, isDesktop && styles.formColumnDesktop]}>{body}</View>
        </View>
      </View>
    </View>
  );

  if (!keyboardAvoid) {
    return <View style={styles.screen}>{page}</View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {page}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: memberColors.bg,
    ...(Platform.OS === 'web' && { minHeight: '100vh' }),
  },
  page: {
    flex: 1,
    position: 'relative',
    ...(Platform.OS === 'web' && { minHeight: '100vh' }),
  },
  contentGrid: {
    flex: 1,
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  contentGridDesktop: {
    maxWidth: '100%',
    alignSelf: 'stretch',
    paddingLeft: '38%',
    paddingRight: 56,
  },
  main: {
    flex: 1,
  },
  mainDesktop: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingTop: 40,
    paddingBottom: 64,
  },
  formColumn: {
    width: '100%',
  },
  formColumnDesktop: {
    width: '100%',
    maxWidth: 380,
    minWidth: 280,
  },
  formInner: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  formInnerDesktop: {
    maxWidth: 360,
    alignSelf: 'flex-start',
    marginTop: 0,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 4,
  },
  scrollContentDesktop: {
    paddingTop: 0,
  },
});

const headerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
    ...(Platform.OS === 'web' && { marginBottom: 24 }),
  },
  wordmark: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: memberColors.ink,
  },
  right: {
    flexShrink: 0,
  },
});

const brandStyles = StyleSheet.create({
  field: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '36%',
    maxWidth: 420,
    backgroundColor: memberColors.court,
    overflow: 'hidden',
    ...(Platform.OS === 'web' && {
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    }),
  },
  copy: {
    position: 'absolute',
    left: 48,
    bottom: '18%',
    maxWidth: 280,
  },
  editorial: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.72)',
  },
});

const accentStyles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
  },
  line: {
    position: 'absolute',
    left: 48,
    right: '20%',
    bottom: '22%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: memberColors.lime,
    left: 48,
    bottom: '22%',
    marginBottom: -2.5,
    opacity: 0.85,
  },
});

const mobileStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  bar: {
    width: 40,
    height: 3,
    backgroundColor: memberColors.court,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: memberColors.lime,
  },
});
