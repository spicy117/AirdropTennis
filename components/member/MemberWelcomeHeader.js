import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberColors, memberTypography, memberWebTransition } from '../../theme/memberTheme';
import { getGreetingKey } from '../../utils/locale';
import { getTranslation } from '../../utils/translations';

export default function MemberWelcomeHeader({
  userName,
  subtitle,
  onOpenSidebar,
  showMenu,
  language,
  onToggleLanguage,
  langEnShort,
  langZhShort,
  compact = false,
}) {
  const t = (key) => getTranslation(language, key);
  const firstName = userName?.split(' ')[0] || userName;
  const greeting = t(getGreetingKey());
  const greetingPunct = language === 'zh-CN' ? '，' : ',';

  if (compact) {
    return (
      <View style={styles.headerCompact}>
        <Text style={styles.greetingCompact}>
          {greeting}
          {greetingPunct} {firstName}
        </Text>
        {subtitle || onToggleLanguage ? (
          <View style={styles.compactSubRow}>
            {subtitle ? (
              <Text style={styles.subtitleCompact} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : (
              <View style={styles.textWrap} />
            )}
            {onToggleLanguage && (
              <Pressable
                style={({ pressed }) => [styles.langBtnCompact, pressed && styles.btnPressed]}
                onPress={onToggleLanguage}
                accessibilityRole="button"
                accessibilityLabel={language === 'en' ? t('switchToChinese') : t('switchToEnglish')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.langTextCompact}>{language === 'en' ? langZhShort : langEnShort}</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {showMenu && onOpenSidebar && (
          <Pressable
            style={({ pressed }) => [styles.menuBtn, pressed && styles.btnPressed]}
            onPress={onOpenSidebar}
            accessibilityLabel={t('openMenu')}
            accessibilityRole="button"
          >
            <Ionicons name="menu" size={22} color={memberColors.ink} />
          </Pressable>
        )}
        <View style={styles.textWrap}>
          <Text style={styles.greeting}>{greeting}{greetingPunct}</Text>
          <Text style={styles.name} numberOfLines={1}>{firstName}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
      {onToggleLanguage && (
        <Pressable
          style={({ pressed }) => [styles.langBtn, pressed && styles.btnPressed]}
          onPress={onToggleLanguage}
          accessibilityRole="button"
          accessibilityLabel={language === 'en' ? t('switchToChinese') : t('switchToEnglish')}
        >
          <Ionicons name="language-outline" size={16} color={memberColors.inkMuted} />
          <Text style={styles.langText}>{language === 'en' ? langZhShort : langEnShort}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerCompact: {
    marginBottom: 4,
  },
  compactSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 10,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: memberColors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: memberColors.border,
    marginTop: 2,
    ...memberWebTransition('background-color, transform'),
  },
  btnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  textWrap: {
    flex: 1,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '500',
    color: memberColors.inkMuted,
    marginBottom: 2,
  },
  greetingCompact: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: memberColors.ink,
    lineHeight: 26,
  },
  name: {
    ...memberTypography.hero,
    fontSize: 30,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: memberColors.inkSecondary,
    fontWeight: '500',
  },
  subtitleCompact: {
    flex: 1,
    fontSize: 13,
    color: memberColors.inkMuted,
    fontWeight: '500',
    lineHeight: 18,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: memberColors.surfaceRaised,
    borderWidth: 1,
    borderColor: memberColors.border,
    ...memberWebTransition('background-color, transform'),
  },
  langBtnCompact: {
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: memberColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    ...memberWebTransition('background-color, transform'),
  },
  langText: {
    fontSize: 12,
    fontWeight: '600',
    color: memberColors.inkMuted,
  },
  langTextCompact: {
    fontSize: 12,
    fontWeight: '700',
    color: memberColors.court,
  },
});
