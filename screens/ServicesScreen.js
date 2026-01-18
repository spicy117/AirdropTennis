import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';

// Brand colors for stained glass effect
const TENNIS_GREEN = '#84cc16';
const DEEP_NAVY = '#1e3a8a';
const ICON_COLORS = {
  'stroke-clinic': '#3b82f6', // Blue
  'boot-camp': '#ef4444', // Red
  'private-lesson': '#8b5cf6', // Purple
  'utr-points-play': '#f59e0b', // Amber
};

const { width } = Dimensions.get('window');
const isDesktop = Platform.OS === 'web' && width > 768;

const services = [
  {
    id: 'stroke-clinic',
    icon: 'fitness',
    title: 'Stroke Clinic',
    description: 'Technical mastery through focused mechanics and footwork drills.',
  },
  {
    id: 'boot-camp',
    icon: 'flame',
    title: 'Boot Camp',
    description: 'High-octane conditioning to sharpen your competitive edge.',
  },
  {
    id: 'private-lesson',
    icon: 'person',
    title: 'Private Lesson',
    description: 'Personalized coaching designed for rapid, measurable growth.',
  },
  {
    id: 'utr-points-play',
    icon: 'trophy',
    title: 'UTR Points Play',
    description: 'Verified match play to build your official UTR rating.',
  },
];

export default function ServicesScreen({ onViewAvailability }) {
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const [hoveredCard, setHoveredCard] = useState(null);

  const handleViewAvailability = (serviceId) => {
    if (onViewAvailability) {
      // Find the service title from the services array
      const service = services.find(s => s.id === serviceId);
      const serviceName = service ? service.title : null;
      onViewAvailability(serviceId, serviceName);
    }
  };

  const handleMouseEnter = (serviceId) => {
    if (Platform.OS === 'web') {
      setHoveredCard(serviceId);
    }
  };

  const handleMouseLeave = () => {
    if (Platform.OS === 'web') {
      setHoveredCard(null);
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* Background Blobs - Organic Shapes */}
      {Platform.OS === 'web' && (
        <>
          <View 
            pointerEvents="none"
            style={[
              styles.backgroundBlob,
              styles.blob1,
              // @ts-ignore - Web-only CSS properties
              Platform.OS === 'web' && {
                backgroundColor: TENNIS_GREEN,
                filter: 'blur(80px)',
                WebkitFilter: 'blur(80px)',
                opacity: 0.3,
              },
            ]}
          />
          <View 
            pointerEvents="none"
            style={[
              styles.backgroundBlob,
              styles.blob2,
              // @ts-ignore - Web-only CSS properties
              Platform.OS === 'web' && {
                backgroundColor: DEEP_NAVY,
                filter: 'blur(100px)',
                WebkitFilter: 'blur(100px)',
                opacity: 0.25,
              },
            ]}
          />
          <View 
            pointerEvents="none"
            style={[
              styles.backgroundBlob,
              styles.blob3,
              // @ts-ignore - Web-only CSS properties
              Platform.OS === 'web' && {
                backgroundColor: TENNIS_GREEN,
                filter: 'blur(90px)',
                WebkitFilter: 'blur(90px)',
                opacity: 0.2,
              },
            ]}
          />
        </>
      )}
      
      {/* Background Grid Pattern - Lower Opacity */}
      {Platform.OS === 'web' && (
        <View 
          pointerEvents="none"
          style={[
            styles.backgroundPattern,
            // @ts-ignore - Web-only CSS properties
            Platform.OS === 'web' && {
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 0)',
              backgroundSize: '32px 32px',
              opacity: 0.05,
            },
          ]}
        />
      )}
      
      {isDesktop ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Header - Centered */}
          <View style={styles.header}>
            <Text style={styles.title}>OUR SERVICES</Text>
          </View>

          {/* Services Grid */}
          <View style={styles.grid}>
            {services.map((service) => {
              const isHovered = hoveredCard === service.id;
              return (
                <View key={service.id} style={styles.cardContainer}>
                  <TouchableOpacity
                    style={[
                      styles.card,
                      isHovered && styles.cardHovered,
                    ]}
                    onPress={() => handleViewAvailability(service.id)}
                    {...(Platform.OS === 'web' && {
                      onMouseEnter: () => handleMouseEnter(service.id),
                      onMouseLeave: handleMouseLeave,
                    })}
                    accessible={true}
                    accessibilityLabel={`View availability for ${service.title}`}
                    accessibilityRole="button"
                    activeOpacity={0.95}
                  >
                    <View style={styles.cardContent}>
                      {/* Glass-morphic Icon Circle */}
                      <View style={styles.iconContainer}>
                        <View 
                          style={[
                            styles.iconCircle,
                            // @ts-ignore - Web-only CSS properties
                            Platform.OS === 'web' && {
                              backgroundColor: 'rgba(255, 255, 255, 0.3)',
                              backdropFilter: 'blur(10px)',
                              WebkitBackdropFilter: 'blur(10px)',
                            },
                          ]}
                        >
                          <Ionicons 
                            name={service.icon} 
                            size={28} 
                            color={ICON_COLORS[service.id] || TENNIS_GREEN} 
                            style={styles.icon} 
                          />
                        </View>
                      </View>

                      {/* Title with Letter Spacing */}
                      <Text style={styles.cardTitle}>{service.title}</Text>

                      {/* Description */}
                      <Text style={styles.cardDescription}>{service.description}</Text>
                    </View>

                    {/* Glass Pill Button */}
                    <TouchableOpacity
                      style={[
                        styles.glassButton,
                        // @ts-ignore - Web-only CSS properties
                        Platform.OS === 'web' && {
                          backgroundColor: 'rgba(255, 255, 255, 0.6)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                        },
                        isHovered && styles.glassButtonHovered,
                      ]}
                      onPress={() => handleViewAvailability(service.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.glassButtonText}>VIEW AVAILABILITY</Text>
                      <Ionicons 
                        name="arrow-forward" 
                        size={14} 
                        color="#000" 
                        style={styles.glassButtonArrow} 
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.mobileContainer}>
          {/* Header - Centered */}
          <View style={styles.mobileHeader}>
            <Text style={styles.title}>OUR SERVICES</Text>
          </View>

          {/* Horizontal Scrollable Cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled={false}
            snapToInterval={width - 48}
            snapToAlignment="start"
            decelerationRate="fast"
            contentContainerStyle={styles.mobileScrollContent}
            style={styles.mobileScroll}
          >
            {services.map((service) => {
              return (
                <View key={service.id} style={styles.mobileCardContainer}>
                  <TouchableOpacity
                    style={styles.card}
                    onPress={() => handleViewAvailability(service.id)}
                    accessible={true}
                    accessibilityLabel={`View availability for ${service.title}`}
                    accessibilityRole="button"
                    activeOpacity={0.95}
                  >
                    <View style={styles.cardContent}>
                      {/* Glass-morphic Icon Circle */}
                      <View style={styles.iconContainer}>
                        <View 
                          style={[
                            styles.iconCircle,
                            // @ts-ignore - Web-only CSS properties
                            Platform.OS === 'web' && {
                              backgroundColor: 'rgba(255, 255, 255, 0.3)',
                              backdropFilter: 'blur(10px)',
                              WebkitBackdropFilter: 'blur(10px)',
                            },
                          ]}
                        >
                          <Ionicons 
                            name={service.icon} 
                            size={24} 
                            color={ICON_COLORS[service.id] || TENNIS_GREEN} 
                            style={styles.icon} 
                          />
                        </View>
                      </View>

                      {/* Title with Letter Spacing */}
                      <Text style={styles.cardTitle}>{service.title}</Text>

                      {/* Description */}
                      <Text style={styles.cardDescription}>{service.description}</Text>
                    </View>

                    {/* Glass Pill Button */}
                    <TouchableOpacity
                      style={[
                        styles.glassButton,
                        // @ts-ignore - Web-only CSS properties
                        Platform.OS === 'web' && {
                          backgroundColor: 'rgba(255, 255, 255, 0.6)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                        },
                      ]}
                      onPress={() => handleViewAvailability(service.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.glassButtonText}>VIEW AVAILABILITY</Text>
                      <Ionicons 
                        name="arrow-forward" 
                        size={14} 
                        color="#000" 
                        style={styles.glassButtonArrow} 
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  backgroundBlob: {
    position: 'absolute',
    borderRadius: 9999,
    zIndex: 0,
  },
  blob1: {
    width: 600,
    height: 600,
    top: -200,
    left: -100,
  },
  blob2: {
    width: 700,
    height: 700,
    top: '30%',
    right: -150,
  },
  blob3: {
    width: 500,
    height: 500,
    bottom: -100,
    left: '20%',
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  container: {
    flex: 1,
    zIndex: 1,
  },
  content: {
    paddingVertical: 96,
    paddingHorizontal: 48,
    paddingBottom: 96,
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 8,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -20,
  },
  cardContainer: {
    width: 'calc(25% - 40px)',
    marginHorizontal: 20,
    marginBottom: 0,
    minWidth: 240,
  },
  mobileContainer: {
    flex: 1,
    zIndex: 1,
  },
  mobileHeader: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileScroll: {
    flex: 1,
  },
  mobileScrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    paddingBottom: Platform.OS !== 'web' ? 120 : 32,
  },
  mobileCardContainer: {
    width: width - 48,
    marginRight: 24,
  },
  card: {
    borderRadius: 24,
    paddingVertical: 48,
    paddingHorizontal: 32,
    minHeight: 480,
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderWidth: 1,
    ...(Platform.OS === 'web' && {
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderColor: 'rgba(255, 255, 255, 0.5)',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer',
      boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2)',
    }),
    ...(Platform.OS !== 'web' && {
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
      borderColor: 'rgba(255, 255, 255, 0.5)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.02,
      shadowRadius: 8,
      elevation: 1,
    }),
    ...(!isDesktop && {
      paddingVertical: 36,
      paddingHorizontal: 24,
      minHeight: 400,
      aspectRatio: 0.7,
    }),
  },
  cardHovered: {
    ...(Platform.OS === 'web' && {
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
      backdropFilter: 'blur(32px)',
      WebkitBackdropFilter: 'blur(32px)',
      borderColor: 'rgba(255, 255, 255, 0.7)',
      transform: [{ translateY: -4 }],
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), inset 0 1px 0 0 rgba(255, 255, 255, 0.3)',
    }),
  },
  cardContent: {
    flex: 1,
  },
  iconContainer: {
    marginBottom: 32,
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...(Platform.OS !== 'web' && {
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
    }),
  },
  icon: {
    // Icon styling handled inline
  },
  cardTitle: {
    fontSize: isDesktop ? 26 : 22,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 16,
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined,
  },
  cardDescription: {
    fontSize: isDesktop ? 16 : 15,
    color: '#1F2937',
    lineHeight: 24,
    letterSpacing: 0.2,
    marginTop: 8,
    opacity: 0.8,
  },
  glassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 9999,
    marginTop: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...(Platform.OS !== 'web' && {
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
    }),
    ...(Platform.OS === 'web' && {
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    }),
  },
  glassButtonHovered: {
    ...(Platform.OS === 'web' && {
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
      transform: [{ translateY: -2 }],
      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
    }),
  },
  glassButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginRight: 8,
  },
  glassButtonArrow: {
    // Arrow styling handled inline
  },
});
