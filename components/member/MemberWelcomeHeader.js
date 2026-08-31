import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberColors, memberTypography } from '../../theme/memberTheme';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function MemberWelcomeHeader({
  userName,
  subtitle,
  onOpenSidebar,
  showMenu,
  language,
  onToggleLanguage,
  langEnShort,
  langZhShort,
}) {
  const firstName = userName?.split(' ')[0] || userName;

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {showMenu && onOpenSidebar && (
          <TouchableOpacity style={styles.menuBtn} onPress={onOpenSidebar} accessibilityLabel="Open menu" accessibilityRole="button">
            <Ionicons name="menu" size={22} color={memberColors.ink} />
          </TouchableOpacity>
        )}
        <View style={styles.textWrap}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.name} numberOfLines={1}>{firstName}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
      {onToggleLanguage && (
        <TouchableOpacity style={styles.langBtn} onPress={onToggleLanguage} accessibilityRole="button">
          <Ionicons name="language-outline" size={16} color={memberColors.inkMuted} />
          <Text style={styles.langText}>{language === 'en' ? langEnShort : langZhShort}</Text>
        </TouchableOpacity>
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
  },
  langText: {
    fontSize: 12,
    fontWeight: '600',
    color: memberColors.inkMuted,
  },
});
