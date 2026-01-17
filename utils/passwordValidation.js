/**
 * Password validation utilities
 * Requirements:
 * - At least 8 characters (length is more important)
 * - Maximum 128 characters (security best practice)
 * - 1 number
 * - 1 uppercase letter
 * - 1 special character
 */

export const validatePassword = (password) => {
  // Check maxLength separately (validated on submit, not shown in real-time)
  const maxLengthValid = password.length <= 128;
  
  const requirements = {
    minLength: password.length >= 8,
    hasNumber: /\d/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  // Include maxLength in validation check but not in returned requirements
  const isValid = Object.values(requirements).every((req) => req === true) && maxLengthValid;

  // Calculate strength (0-4, cap at 4 for display) - excludes maxLength
  const strength = Math.min(Object.values(requirements).filter(Boolean).length, 4);

  return {
    isValid,
    requirements,
    strength,
  };
};

export const getStrengthLabel = (strength) => {
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return labels[strength] || 'Very Weak';
};

export const getStrengthColor = (strength) => {
  // Red → Orange → Yellow → Green
  const colors = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#34C759'];
  return colors[strength] || '#FF3B30';
};
