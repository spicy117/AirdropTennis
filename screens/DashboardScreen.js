import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  ActivityIndicator,
  Animated,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { getTranslation } from '../utils/translations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isDesktop = Platform.OS === 'web' && SCREEN_WIDTH > 768;
const isTablet = Platform.OS === 'web' && SCREEN_WIDTH > 480 && SCREEN_WIDTH <= 768;
const isMobile = Platform.OS !== 'web' || SCREEN_WIDTH <= 480;

// Season Pass Benefits for Modal
const SEASON_PASS_BENEFITS = [
  { icon: 'tennisball', title: 'Fixed Weekly Clinic', description: 'Guaranteed spot every week' },
  { icon: 'person', title: 'Private Lesson Credits', description: 'Flexible 1-on-1 sessions' },
  { icon: 'wallet', title: 'Save Up to 25%', description: 'Compared to individual bookings' },
  { icon: 'calendar', title: 'Priority Booking', description: 'Early access to new slots' },
  { icon: 'ribbon', title: 'Member Perks', description: 'Exclusive discounts & events' },
];

// Service configurations
const SERVICES = [
  {
    id: 'stroke-clinic',
    name: 'Stroke Clinic',
    shortDesc: 'Perfect your technique',
    fullDescription: 'Master tennis fundamentals with expert-led drills focusing on forehand, backhand, serve, and volley techniques.',
    whatToBring: ['Tennis racket', 'Water bottle', 'Athletic shoes', 'Comfortable sportswear'],
    skillLevel: 'All levels',
    duration: '1 hour',
    icon: 'tennisball',
    tag: 'Popular',
    price: 45,
    color: '#0D9488',
    bgColor: 'rgba(13, 148, 136, 0.08)',
    borderColor: 'rgba(13, 148, 136, 0.2)',
  },
  {
    id: 'boot-camp',
    name: 'Boot Camp',
    shortDesc: 'High-intensity training',
    fullDescription: 'Push your limits with intensive conditioning combining cardio, agility, and tennis-specific exercises.',
    whatToBring: ['Tennis racket', 'Towel', 'Water bottle', 'Athletic shoes'],
    skillLevel: 'Intermediate+',
    duration: '3 hours',
    icon: 'fitness',
    tag: 'Value',
    price: 35,
    color: '#D97706',
    bgColor: 'rgba(217, 119, 6, 0.08)',
    borderColor: 'rgba(217, 119, 6, 0.2)',
  },
  {
    id: 'private-lessons',
    name: 'Private Lessons',
    shortDesc: 'One-on-one coaching',
    fullDescription: 'Accelerate your progress with dedicated coaching tailored to your specific goals and skill level.',
    whatToBring: ['Tennis racket', 'Water bottle', 'Athletic shoes'],
    skillLevel: 'All levels',
    duration: '1 hour',
    icon: 'person',
    tag: 'Premium',
    price: 85,
    color: '#2563EB',
    bgColor: 'rgba(37, 99, 235, 0.08)',
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  {
    id: 'utr-points-play',
    name: 'UTR Points',
    shortDesc: 'Competitive matches',
    fullDescription: 'Compete in official UTR-rated matches to build your Universal Tennis Rating.',
    whatToBring: ['Tennis racket', 'Match attire', 'Water bottle'],
    skillLevel: 'UTR 2.0+',
    duration: '2 hours',
    icon: 'trophy',
    tag: null,
    price: 55,
    color: '#7C3AED',
    bgColor: 'rgba(124, 58, 237, 0.08)',
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
];

// ============================================
// Season Pass Hero - Modern Glass Card
// ============================================
const SeasonPassHero = ({ onLearnMore }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.985,
      useNativeDriver: Platform.OS !== 'web',
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      friction: 10,
    }).start();
  };

  return (
    <Animated.View style={[heroStyles.wrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={0.98}
        onPress={onLearnMore}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={heroStyles.touchable}
      >
        {/* Glass Card with Gradient Border */}
        {Platform.OS === 'web' ? (
          <div style={{
            position: 'relative',
            borderRadius: 20,
            padding: 1,
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(13, 148, 136, 0.3) 100%)',
          }}>
            <View style={heroStyles.card}>
              {/* Term Stamp - Vertical Serial Number */}
              <View style={heroStyles.termStamp}>
                <Text style={heroStyles.termStampText}>T</Text>
                <Text style={heroStyles.termStampText}>E</Text>
                <Text style={heroStyles.termStampText}>R</Text>
                <Text style={heroStyles.termStampText}>M</Text>
                <View style={heroStyles.termStampDivider} />
                <Text style={heroStyles.termStampText}>0</Text>
                <Text style={heroStyles.termStampText}>1</Text>
                <View style={heroStyles.termStampDivider} />
                <Text style={heroStyles.termStampText}>2</Text>
                <Text style={heroStyles.termStampText}>6</Text>
              </View>

              {/* Main Content */}
              <View style={heroStyles.content}>
                {/* Title Section */}
                <View style={heroStyles.titleSection}>
                  <Text style={heroStyles.mainTitle}>ELITE DEVELOPMENT PROGRAM</Text>
                  <Text style={heroStyles.tagline}>10-week professional curriculum</Text>
                </View>

                {/* Glass Benefits Row */}
                <View style={heroStyles.benefitsRow}>
                  {/* Benefit 1 - Frosted Pocket */}
                  <View style={heroStyles.benefitPocket}>
                    <Ionicons name="tennisball-outline" size={16} color="#0D9488" />
                    <Text style={heroStyles.benefitLabel}>Academy Clinic</Text>
                  </View>

                  {/* Benefit 2 - Frosted Pocket */}
                  <View style={heroStyles.benefitPocket}>
                    <Ionicons name="person-outline" size={16} color="#0D9488" />
                    <Text style={heroStyles.benefitLabel}>Private Performance</Text>
                  </View>

                  {/* Benefit 3 - Frosted Pocket */}
                  <View style={heroStyles.benefitPocket}>
                    <Ionicons name="analytics-outline" size={16} color="#0D9488" />
                    <Text style={heroStyles.benefitLabel}>Analysis Reports</Text>
                  </View>
                </View>
              </View>

              {/* CTA Section */}
              <View style={heroStyles.ctaSection}>
                <TouchableOpacity 
                  onPress={onLearnMore}
                  activeOpacity={0.7}
                >
                  <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  className="cta-link"
                  >
                    <style>{`
                      .cta-link:hover {
                        text-shadow: 0 0 20px rgba(13, 148, 136, 0.5);
                      }
                      .cta-link:hover .cta-text {
                        text-shadow: 0 0 20px rgba(13, 148, 136, 0.5);
                      }
                    `}</style>
                    <Text style={heroStyles.ctaText}>EXPLORE THE PROGRAM</Text>
                    <Ionicons name="arrow-forward" size={14} color="#0D9488" />
                  </div>
                </TouchableOpacity>
              </View>
            </View>
          </div>
        ) : (
          <View style={heroStyles.nativeCard}>
            {/* Term Stamp - Vertical Serial Number */}
            <View style={heroStyles.termStamp}>
              <Text style={heroStyles.termStampText}>T</Text>
              <Text style={heroStyles.termStampText}>E</Text>
              <Text style={heroStyles.termStampText}>R</Text>
              <Text style={heroStyles.termStampText}>M</Text>
              <View style={heroStyles.termStampDivider} />
              <Text style={heroStyles.termStampText}>0</Text>
              <Text style={heroStyles.termStampText}>1</Text>
              <View style={heroStyles.termStampDivider} />
              <Text style={heroStyles.termStampText}>2</Text>
              <Text style={heroStyles.termStampText}>6</Text>
            </View>

            {/* Main Content */}
            <View style={heroStyles.content}>
              {/* Title Section */}
              <View style={heroStyles.titleSection}>
                <Text style={heroStyles.mainTitle}>ELITE DEVELOPMENT PROGRAM</Text>
                <Text style={heroStyles.tagline}>10-week professional curriculum</Text>
              </View>

              {/* Glass Benefits Row */}
              <View style={heroStyles.benefitsRow}>
                {/* Benefit 1 - Frosted Pocket */}
                <View style={heroStyles.benefitPocket}>
                  <Ionicons name="tennisball-outline" size={16} color="#0D9488" />
                  <Text style={heroStyles.benefitLabel}>Academy Clinic</Text>
                </View>

                {/* Benefit 2 - Frosted Pocket */}
                <View style={heroStyles.benefitPocket}>
                  <Ionicons name="person-outline" size={16} color="#0D9488" />
                  <Text style={heroStyles.benefitLabel}>Private Performance</Text>
                </View>

                {/* Benefit 3 - Frosted Pocket */}
                <View style={heroStyles.benefitPocket}>
                  <Ionicons name="analytics-outline" size={16} color="#0D9488" />
                  <Text style={heroStyles.benefitLabel}>Analysis Reports</Text>
                </View>
              </View>
            </View>

            {/* CTA Section */}
            <View style={heroStyles.ctaSection}>
              <TouchableOpacity 
                style={heroStyles.ctaLink}
                onPress={onLearnMore}
                activeOpacity={0.7}
              >
                <Text style={heroStyles.ctaText}>EXPLORE THE PROGRAM</Text>
                <Ionicons name="arrow-forward" size={14} color="#0D9488" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const heroStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 24,
  },
  touchable: {
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)', // Semi-transparent white glass
    borderRadius: 19,
    padding: 0,
    position: 'relative',
    overflow: 'hidden',
    minHeight: isMobile ? 200 : 180,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(40px)',
      WebkitBackdropFilter: 'blur(40px)',
    }),
  },
  nativeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 20,
    padding: 0,
    position: 'relative',
    overflow: 'hidden',
    minHeight: isMobile ? 200 : 180,
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.2)',
  },
  termStamp: {
    position: 'absolute',
    right: isMobile ? 12 : 20,
    top: isMobile ? 16 : 20,
    bottom: isMobile ? 50 : 50,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  termStampText: {
    fontSize: 8,
    fontWeight: '500',
    color: '#9CA3AF', // Light grey - subtle texture
    letterSpacing: 1,
    lineHeight: 12,
  },
  termStampDivider: {
    width: 1,
    height: 6,
    backgroundColor: 'rgba(156, 163, 175, 0.3)',
    marginVertical: 4,
  },
  content: {
    paddingTop: isMobile ? 24 : 28,
    paddingBottom: 0,
    paddingHorizontal: isMobile ? 20 : 28,
    paddingRight: isMobile ? 40 : 60, // Space for term stamp
    position: 'relative',
    zIndex: 2,
  },
  titleSection: {
    marginBottom: isMobile ? 18 : 22,
  },
  mainTitle: {
    fontSize: isMobile ? 12 : 13, // Smaller, more architectural
    fontWeight: '600',
    color: '#1F2937', // Deep charcoal - softer than black
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 8,
    ...(Platform.OS === 'web' && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  tagline: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    letterSpacing: 0.3,
  },
  benefitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: isMobile ? 8 : 12,
    flexWrap: 'wrap',
  },
  benefitPocket: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }),
  },
  benefitLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#374151',
    letterSpacing: 0.3,
  },
  ctaSection: {
    marginTop: isMobile ? 18 : 22,
    paddingVertical: 14,
    paddingHorizontal: isMobile ? 20 : 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.04)',
  },
  ctaLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0D9488', // Primary brand teal
    letterSpacing: 2,
  },
});

// ============================================
// Season Pass Modal - Immersive Glass Enrollment Portal
// ============================================
const SeasonPassModal = ({ visible, onClose }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 65,
      }).start();
      
      // Icon glow animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      ).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  // Bento grid benefit items
  const benefits = [
    { icon: 'tennisball', color: '#0D9488', bgColor: 'rgba(13, 148, 136, 0.1)', title: 'Structured Weekly Clinic' },
    { icon: 'person', color: '#7C3AED', bgColor: 'rgba(124, 58, 237, 0.1)', title: 'Bi-Weekly Private Coaching' },
    { icon: 'analytics', color: '#2563EB', bgColor: 'rgba(37, 99, 235, 0.1)', title: 'Term Progress Reports' },
    { icon: 'star', color: '#D97706', bgColor: 'rgba(217, 119, 6, 0.1)', title: 'Priority Booking & Events' },
  ];

  const renderModalContent = () => (
    <View style={modalStyles.innerContent}>
      {/* Tennis Court Watermark Background */}
      <View style={modalStyles.courtWatermark}>
        <View style={modalStyles.courtOuter}>
          <View style={modalStyles.courtInner}>
            <View style={modalStyles.courtCenterLine} />
            <View style={modalStyles.courtServiceLine} />
          </View>
        </View>
      </View>

      {/* Close Button */}
      <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose}>
        <Ionicons name="close" size={18} color="#9CA3AF" />
      </TouchableOpacity>

      {/* Header */}
      <View style={modalStyles.header}>
        <Text style={modalStyles.headerTitle}>ELITE DEVELOPMENT PROGRAM</Text>
        <Text style={modalStyles.headerSubtitle}>TERM 01 • 2026</Text>
      </View>

      {/* Bento Grid Benefits - No ScrollView for compact fit */}
      <View style={modalStyles.bentoGrid}>
        {benefits.map((benefit, index) => (
          <View key={index} style={[modalStyles.bentoCard, { backgroundColor: benefit.bgColor }]}>
            <View style={[modalStyles.bentoIconContainer, { backgroundColor: `${benefit.color}12` }]}>
              <Ionicons name={benefit.icon} size={18} color={benefit.color} />
            </View>
            <Text style={modalStyles.bentoTitle}>{benefit.title}</Text>
          </View>
        ))}
      </View>

      {/* Pricing Section - Compact */}
      <View style={modalStyles.priceSection}>
        <Text style={modalStyles.priceLabel}>TERM INVESTMENT</Text>
        {Platform.OS === 'web' ? (
          <div style={{
            background: 'linear-gradient(135deg, #0D9488 0%, #2563EB 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: 40,
            fontWeight: '800',
            letterSpacing: -1,
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          }}>
            $1,200<span style={{ fontSize: 16, fontWeight: '500', opacity: 0.5 }}>/term</span>
          </div>
        ) : (
          <Text style={modalStyles.priceAmount}>$1,200<Text style={modalStyles.pricePeriod}>/term</Text></Text>
        )}
        <View style={modalStyles.savingsBadge}>
          <Ionicons name="checkmark-circle" size={12} color="#0D9488" />
          <Text style={modalStyles.savingsText}>Saves 15% vs individual bookings</Text>
        </View>
      </View>

      {/* Footer CTA - Compact */}
      <View style={modalStyles.footer}>
        <TouchableOpacity style={modalStyles.enrollBtn} onPress={onClose} activeOpacity={0.9}>
          <Text style={modalStyles.enrollBtnText}>ENROLL NOW</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={modalStyles.trustRow}>
          <Ionicons name="lock-closed" size={10} color="#D1D5DB" />
          <Text style={modalStyles.trustText}>Secure Enrollment</Text>
        </View>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        {Platform.OS === 'web' ? (
          <Animated.View style={[modalStyles.animatedContainer, { transform: [{ translateY }] }]}>
            {/* Floating Icon - OUTSIDE container to avoid clipping */}
            <View style={modalStyles.floatingIconWrapper}>
              <Animated.View style={[modalStyles.floatingIconGlow, { opacity: glowOpacity }]} />
              <View style={modalStyles.floatingIcon}>
                <Ionicons name="tennisball" size={28} color="#FFFFFF" />
              </View>
            </View>
            
            <div style={{
              borderRadius: 28,
              padding: 0.5,
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(13, 148, 136, 0.25) 100%)',
              maxWidth: isDesktop ? 420 : '92%',
              width: '100%',
              margin: 'auto',
              marginTop: 30,
            }}>
              <View style={modalStyles.container}>
                {renderModalContent()}
              </View>
            </div>
          </Animated.View>
        ) : (
          <Animated.View style={[modalStyles.nativeWrapper, { transform: [{ translateY }] }]}>
            {/* Floating Icon - OUTSIDE container to avoid clipping */}
            <View style={modalStyles.floatingIconWrapper}>
              <Animated.View style={[modalStyles.floatingIconGlow, { opacity: glowOpacity }]} />
              <View style={modalStyles.floatingIcon}>
                <Ionicons name="tennisball" size={28} color="#FFFFFF" />
              </View>
            </View>
            
            <View style={modalStyles.nativeContainer}>
              {renderModalContent()}
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    ...(Platform.OS === 'web' && { 
      backdropFilter: 'blur(40px)',
      WebkitBackdropFilter: 'blur(40px)',
    }),
  },
  animatedContainer: {
    width: '100%',
    maxWidth: isDesktop ? 420 : 400,
    alignItems: 'center',
  },
  nativeWrapper: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 27,
    overflow: 'visible', // Allow icon to break frame
    position: 'relative',
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(40px)',
      WebkitBackdropFilter: 'blur(40px)',
    }),
  },
  nativeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 28,
    overflow: 'visible', // Allow icon to break frame
    position: 'relative',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    marginTop: 30,
    width: '92%',
  },
  innerContent: {
    paddingTop: 36, // Space for floating icon
  },
  courtWatermark: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    transform: [{ translateX: -80 }, { translateY: -60 }, { rotate: '45deg' }],
    opacity: 0.025,
    zIndex: 0,
  },
  courtOuter: {
    width: 160,
    height: 120,
    borderWidth: 1.5,
    borderColor: '#374151',
    borderRadius: 3,
    padding: 6,
  },
  courtInner: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#374151',
    position: 'relative',
  },
  courtCenterLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#374151',
  },
  courtServiceLine: {
    position: 'absolute',
    top: '25%',
    left: '20%',
    right: '20%',
    height: 1,
    backgroundColor: '#374151',
  },
  floatingIconWrapper: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -28,
    zIndex: 99,
  },
  floatingIconGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0D9488',
    ...(Platform.OS === 'web' && {
      filter: 'blur(16px)',
    }),
  },
  floatingIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 6px 24px rgba(13, 148, 136, 0.35)',
    }),
    ...(Platform.OS !== 'web' && {
      shadowColor: '#0D9488',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    }),
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 4,
    ...(Platform.OS === 'web' && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
    letterSpacing: 2,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  bentoCard: {
    width: '48%',
    borderRadius: 14,
    padding: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      transition: 'transform 0.15s ease',
      cursor: 'pointer',
    }),
  },
  bentoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  bentoTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    lineHeight: 14,
  },
  priceSection: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  priceLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 2,
    marginBottom: 4,
  },
  priceAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: '#0D9488',
    letterSpacing: -1,
  },
  pricePeriod: {
    fontSize: 16,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginTop: 8,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0D9488',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    alignItems: 'center',
  },
  enrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    width: '100%',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
      transition: 'all 0.15s ease',
      cursor: 'pointer',
    }),
    ...(Platform.OS !== 'web' && {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 3,
    }),
  },
  enrollBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  trustText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#D1D5DB',
  },
});

// ============================================
// Service Card - Compact & Modern
// ============================================
const ServiceCard = ({ service, onPress, onMoreInfo }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: Platform.OS !== 'web',
      friction: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      friction: 8,
    }).start();
  };

  return (
    <Animated.View
      style={[
        cardStyles.wrapper,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <TouchableOpacity
        style={[cardStyles.card, { borderColor: service.borderColor }]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {/* Header */}
        <View style={cardStyles.header}>
          <View style={[cardStyles.iconContainer, { backgroundColor: service.bgColor }]}>
            <Ionicons name={service.icon} size={20} color={service.color} />
          </View>
          {service.tag && (
            <View style={[cardStyles.tag, { backgroundColor: service.bgColor }]}>
              <Text style={[cardStyles.tagText, { color: service.color }]}>{service.tag}</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <Text style={cardStyles.title}>{service.name}</Text>
        <Text style={cardStyles.desc}>{service.shortDesc}</Text>

        {/* Footer */}
        <View style={cardStyles.footer}>
          <Text style={[cardStyles.price, { color: service.color }]}>${service.price}</Text>
          <TouchableOpacity
            style={cardStyles.infoBtn}
            onPress={(e) => {
              e.stopPropagation();
              onMoreInfo(service);
            }}
          >
            <Text style={cardStyles.infoBtnText}>Info</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const cardStyles = StyleSheet.create({
  wrapper: {
    width: isMobile ? '48%' : isDesktop ? '24%' : '48%',
    marginBottom: 12,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)', // Increased transparency
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)', // Low-opacity white border
    padding: 14,
    minHeight: isMobile ? 140 : 150,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(50px)', // Increased blur
      WebkitBackdropFilter: 'blur(50px)',
      cursor: 'pointer',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
    }),
    ...(Platform.OS === 'web' && {
      ':hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  desc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  infoBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
});

// ============================================
// Service Info Modal
// ============================================
const ServiceInfoModal = ({ visible, service, onClose, onBook }) => {
  if (!service) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={serviceModalStyles.overlay}>
        <View style={serviceModalStyles.container}>
          <View style={[serviceModalStyles.header, { backgroundColor: service.bgColor }]}>
            <View style={[serviceModalStyles.headerIcon, { backgroundColor: service.color + '20' }]}>
              <Ionicons name={service.icon} size={40} color={service.color} />
            </View>
            <TouchableOpacity style={serviceModalStyles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={serviceModalStyles.content} showsVerticalScrollIndicator={false}>
            <View style={serviceModalStyles.titleRow}>
              <Text style={[serviceModalStyles.title, { color: service.color }]}>{service.name}</Text>
              {service.tag && (
                <View style={[serviceModalStyles.tag, { backgroundColor: service.bgColor }]}>
                  <Text style={[serviceModalStyles.tagText, { color: service.color }]}>{service.tag}</Text>
                </View>
              )}
            </View>

            <View style={serviceModalStyles.metaRow}>
              <View style={serviceModalStyles.metaItem}>
                <Ionicons name="pricetag-outline" size={14} color="#64748B" />
                <Text style={serviceModalStyles.metaText}>${service.price}</Text>
              </View>
              <View style={serviceModalStyles.metaItem}>
                <Ionicons name="time-outline" size={14} color="#64748B" />
                <Text style={serviceModalStyles.metaText}>{service.duration}</Text>
              </View>
              <View style={serviceModalStyles.metaItem}>
                <Ionicons name="speedometer-outline" size={14} color="#64748B" />
                <Text style={serviceModalStyles.metaText}>{service.skillLevel}</Text>
              </View>
            </View>

            <View style={serviceModalStyles.section}>
              <Text style={serviceModalStyles.sectionTitle}>About</Text>
              <Text style={serviceModalStyles.sectionText}>{service.fullDescription}</Text>
            </View>

            <View style={serviceModalStyles.section}>
              <Text style={serviceModalStyles.sectionTitle}>What to Bring</Text>
              {service.whatToBring.map((item, i) => (
                <View key={i} style={serviceModalStyles.listItem}>
                  <View style={[serviceModalStyles.listDot, { backgroundColor: service.color }]} />
                  <Text style={serviceModalStyles.listText}>{item}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={serviceModalStyles.footer}>
            <TouchableOpacity
              style={[serviceModalStyles.bookBtn, { backgroundColor: service.color }]}
              onPress={() => onBook(service.name)}
            >
              <Text style={serviceModalStyles.bookBtnText}>Find Availability</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const serviceModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web' && { backdropFilter: 'blur(4px)' }),
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.8,
    ...(Platform.OS === 'web' && isDesktop && {
      maxWidth: 440,
      marginHorizontal: 'auto',
      marginBottom: 40,
      borderRadius: 24,
    }),
  },
  header: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    position: 'relative',
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  sectionText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  listDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  listText: {
    fontSize: 14,
    color: '#475569',
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  bookBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});

// ============================================
// Stat Card Component
// ============================================
const StatCard = ({ icon, iconColor, iconBg, label, value, subValue, action, actionColor, onAction, loading }) => {
  return (
    <View style={statStyles.card}>
      <View style={[statStyles.iconContainer, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={statStyles.label}>{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} style={{ marginTop: 6 }} />
      ) : (
        <>
          <Text style={statStyles.value}>{value}</Text>
          {subValue && <Text style={statStyles.subValue}>{subValue}</Text>}
        </>
      )}
      {action && (
        <TouchableOpacity style={[statStyles.actionBtn, { borderColor: actionColor }]} onPress={onAction}>
          <Text style={[statStyles.actionText, { color: actionColor }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const statStyles = StyleSheet.create({
  card: {
    flex: isMobile ? undefined : 1,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(12px)',
    }),
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  subValue: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  actionBtn: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

// ============================================
// Main Dashboard Screen
// ============================================
export default function DashboardScreen({ onBookLesson, onSelectService, refreshTrigger }) {
  const insets = useSafeAreaInsets();
  const { user, userRole } = useAuth();
  const { language, updateLanguage } = useLanguage();
  const t = (key) => getTranslation(language, key);

  const isStudent = userRole === 'student' || (!userRole || (userRole !== 'admin' && userRole !== 'coach'));

  const [creditBalance] = useState(125.50);
  const [nextBooking, setNextBooking] = useState(null);
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [showSeasonPassModal, setShowSeasonPassModal] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);

  const userName =
    [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
      .filter(Boolean)
      .join(' ') ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    t('student');

  useEffect(() => {
    if (user) loadBookings();
  }, [user]);

  useEffect(() => {
    if (user && refreshTrigger !== undefined) loadBookings();
  }, [refreshTrigger]);

  const loadBookings = async () => {
    if (!user) return;
    try {
      setLoadingBooking(true);
      const { data, error } = await supabase
        .from('bookings')
        .select('*, locations:location_id (id, name)')
        .eq('user_id', user.id)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;
      setNextBooking(data?.length > 0 ? data[0] : null);
      setUpcomingBookings(data || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoadingBooking(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const handleServicePress = (serviceName) => {
    if (onSelectService) onSelectService(serviceName);
    else if (onBookLesson) onBookLesson();
  };

  const handleMoreInfo = (service) => {
    setSelectedService(service);
    setShowServiceModal(true);
  };

  return (
    <View style={styles.screen}>
      {/* Subtle gradient background */}
      <View style={styles.bgGradient}>
        <View style={[styles.bgOrb, styles.bgOrb1]} />
        <View style={[styles.bgOrb, styles.bgOrb2]} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{t('welcome')}</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          {isStudent && (
            <TouchableOpacity
              style={styles.langToggle}
              onPress={() => updateLanguage(language === 'en' ? 'zh-CN' : 'en')}
            >
              <Ionicons name="language-outline" size={14} color="#64748B" />
              <Text style={styles.langText}>{language === 'en' ? 'EN' : '中文'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Season Pass Hero */}
        <SeasonPassHero onLearnMore={() => setShowSeasonPassModal(true)} />

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            icon="wallet"
            iconColor="#10B981"
            iconBg="rgba(16, 185, 129, 0.12)"
            label="Credit Balance"
            value={`$${creditBalance.toFixed(2)}`}
            action="Top Up"
            actionColor="#10B981"
            onAction={() => {}}
          />
          <StatCard
            icon="calendar"
            iconColor="#3B82F6"
            iconBg="rgba(59, 130, 246, 0.12)"
            label="Next Booking"
            value={nextBooking ? formatDate(nextBooking.start_time) : 'None'}
            subValue={nextBooking ? `${formatTime(nextBooking.start_time)} • ${nextBooking.locations?.name || 'TBD'}` : null}
            action={!nextBooking ? 'Book Now' : null}
            actionColor="#3B82F6"
            onAction={onBookLesson}
            loading={loadingBooking}
          />
        </View>

        {/* Services Section */}
        <View style={styles.servicesSection}>
          <Text style={styles.sectionHeader}>SELECT A SERVICE</Text>
          <View style={styles.servicesGrid}>
            {SERVICES.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onPress={() => handleServicePress(service.name)}
                onMoreInfo={handleMoreInfo}
              />
            ))}
          </View>
        </View>

        {/* Upcoming Lessons */}
        <View style={styles.upcomingSection}>
          <View style={styles.upcomingHeader}>
            <Text style={styles.sectionHeader}>UPCOMING LESSONS</Text>
            {upcomingBookings.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{upcomingBookings.length}</Text>
              </View>
            )}
          </View>

          {loadingBooking ? (
            <ActivityIndicator size="large" color="#3B82F6" style={{ paddingVertical: 40 }} />
          ) : upcomingBookings.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={32} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyTitle}>No lessons yet</Text>
              <Text style={styles.emptySubtitle}>Book your first lesson to get started</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={onBookLesson}>
                <Text style={styles.emptyBtnText}>Book Now</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.bookingsList}>
              {upcomingBookings.slice(0, 4).map((booking, i) => (
                <View key={booking.id} style={[styles.bookingItem, i > 0 && { marginTop: 10 }]}>
                  <View style={styles.bookingDate}>
                    <Text style={styles.bookingDay}>{new Date(booking.start_time).getDate()}</Text>
                    <Text style={styles.bookingMonth}>
                      {new Date(booking.start_time).toLocaleDateString('en-US', { month: 'short' })}
                    </Text>
                  </View>
                  <View style={styles.bookingInfo}>
                    <Text style={styles.bookingTitle}>{booking.service_name || 'Tennis Lesson'}</Text>
                    <Text style={styles.bookingMeta}>
                      {formatTime(booking.start_time)} • {booking.locations?.name || 'TBD'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      <SeasonPassModal visible={showSeasonPassModal} onClose={() => setShowSeasonPassModal(false)} />
      <ServiceInfoModal
        visible={showServiceModal}
        service={selectedService}
        onClose={() => {
          setShowServiceModal(false);
          setSelectedService(null);
        }}
        onBook={(serviceName) => {
          setShowServiceModal(false);
          setSelectedService(null);
          handleServicePress(serviceName);
        }}
      />
    </View>
  );
}

// ============================================
// Main Styles
// ============================================
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  bgGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  bgOrb: {
    position: 'absolute',
    borderRadius: 999,
    ...(Platform.OS === 'web' && { filter: 'blur(100px)' }),
    ...(Platform.OS !== 'web' && { opacity: 0.4 }),
  },
  bgOrb1: {
    width: 300,
    height: 300,
    top: -80,
    right: -80,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
  },
  bgOrb2: {
    width: 250,
    height: 250,
    bottom: 100,
    left: -60,
    backgroundColor: 'rgba(139, 92, 246, 0.06)',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    maxWidth: 1000,
    ...(Platform.OS === 'web' && isDesktop && {
      marginHorizontal: 'auto',
      width: '100%',
      padding: 32,
    }),
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  langToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    gap: 4,
  },
  langText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },

  // Stats Row
  statsRow: {
    flexDirection: isMobile ? 'column' : 'row',
    gap: 12,
    marginBottom: 24,
  },

  // Services Section
  servicesSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: isMobile ? 8 : 12,
  },

  // Upcoming Section
  upcomingSection: {},
  upcomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  countBadge: {
    backgroundColor: '#0F172A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  emptyBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // Bookings List
  bookingsList: {},
  bookingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  bookingDate: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bookingDay: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
  },
  bookingMonth: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  bookingInfo: {
    flex: 1,
  },
  bookingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  bookingMeta: {
    fontSize: 12,
    color: '#64748B',
  },
});
