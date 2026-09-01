import React from 'react';
import { ScrollView, View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import MemberServiceCard from './MemberServiceCard';

export default function ServiceCarousel({ services, onPress, onMoreInfo, infoLabel }) {
  const { width } = useWindowDimensions();
  const gap = 12;
  const cardWidth = Math.min(280, Math.max(240, width * 0.82));
  const snapInterval = cardWidth + gap;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={snapInterval}
      snapToAlignment="start"
      disableIntervalMomentum
      contentContainerStyle={styles.content}
      style={[styles.scroll, Platform.OS === 'web' && styles.scrollWeb]}
    >
      {services.map((service, i) => (
        <View
          key={service.id}
          style={[
            styles.item,
            { width: cardWidth },
            i === services.length - 1 && styles.itemLast,
          ]}
        >
          <MemberServiceCard
            service={service}
            onPress={() => onPress(service)}
            onMoreInfo={onMoreInfo}
            infoLabel={infoLabel}
            width={cardWidth}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginHorizontal: -4,
  },
  scrollWeb: {
    ...(Platform.OS === 'web' && {
      scrollSnapType: 'x mandatory',
      WebkitOverflowScrolling: 'touch',
    }),
  },
  content: {
    paddingHorizontal: 4,
    paddingBottom: 6,
    gap: 12,
  },
  item: {
    marginRight: 12,
    ...(Platform.OS === 'web' && { scrollSnapAlign: 'start' }),
  },
  itemLast: {
    marginRight: 24,
  },
});
