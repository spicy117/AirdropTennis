import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

const LanguageContext = createContext({});

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

const LANGUAGE_STORAGE_KEY = 'user_language_preference';

export const LanguageProvider = ({ children }) => {
  const { user, userRole } = useAuth();
  const [language, setLanguage] = useState('en'); // 'en' or 'zh-CN'
  const [loading, setLoading] = useState(true);

  // Load language preference on mount
  useEffect(() => {
    loadLanguagePreference();
  }, [user]);

  const loadLanguagePreference = async () => {
    try {
      setLoading(true);
      
      // First, try to get from user profile in Supabase
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('language_preference')
          .eq('id', user.id)
          .single();

        if (profile?.language_preference) {
          setLanguage(profile.language_preference);
          await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, profile.language_preference);
          setLoading(false);
          return;
        }
      }

      // Fallback to local storage
      const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (storedLanguage && (storedLanguage === 'en' || storedLanguage === 'zh-CN')) {
        setLanguage(storedLanguage);
      }
    } catch (error) {
      console.error('Error loading language preference:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLanguage = async (newLanguage) => {
    if (newLanguage !== 'en' && newLanguage !== 'zh-CN') {
      console.error('Invalid language:', newLanguage);
      return;
    }

    try {
      setLanguage(newLanguage);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage);

      // Update user profile in Supabase if user is logged in
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .update({ language_preference: newLanguage })
          .eq('id', user.id);

        if (error) {
          console.error('Error updating language preference in profile:', error);
        }
      }
    } catch (error) {
      console.error('Error updating language preference:', error);
    }
  };

  const value = {
    language,
    updateLanguage,
    loading,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
