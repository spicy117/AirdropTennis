/**
 * Service pricing configuration
 * Matches the pricing in DashboardScreen.js
 */
export const SERVICE_PRICES = {
  'Stroke Clinic': 99.99,
  'Boot Camp': 149.99,
  'Private Lessons': 149.99,
  'Private Lesson': 149.99,
  'UTR Points': 149.99,
  'UTR Points Play': 149.99,
};

/**
 * Calculate the total cost for a booking based on service name and duration
 */
export const calculateBookingCost = (serviceName, durationHours) => {
  const basePrice = SERVICE_PRICES[serviceName] || 149.99; // Default to Private Lesson price
  
  // For now, we use flat pricing per service
  // In the future, you might want to calculate based on duration
  return basePrice;
};

/**
 * Calculate total cost for multiple bookings
 */
export const calculateTotalCost = (bookings) => {
  return bookings.reduce((total, booking) => {
    const cost = calculateBookingCost(booking.service_name, booking.duration);
    return total + cost;
  }, 0);
};
