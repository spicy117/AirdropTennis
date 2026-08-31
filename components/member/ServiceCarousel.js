import React from 'react';
import { ScrollView, View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import MemberServiceCard from './MemberServiceCard';

export default function ServiceCarousel({ services, onPress, onMoreInfo, infoLabel }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(280, width * 0.78);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={cardWidth + 12}
      snapToAlignment="start"
      contentContainerStyle={styles.content}
      style={styles.scroll}
    >
      {services.map((service, i) => (
        <View key={service.id} style={[styles.item, i === services.length - 1 && styles.itemLast]}>
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
  content: {
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  item: {
    marginRight: 12,
  },
  itemLast: {
    marginRight: 24,
  },
});
