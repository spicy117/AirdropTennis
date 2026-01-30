import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Supabase configuration (should match lib/supabase.js)
const SUPABASE_URL = 'https://qdlzumzkhbnxpkprbuju.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkbHp1bXpraGJueHBrcHJidWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzcyOTQsImV4cCI6MjA4MzkxMzI5NH0.eT8PBsjdPxRodqIf5e_JRKVV-PztvkG06DDaKjc7fas';

export default function AdminCoachesScreen({ onNavigate }) {
  const { user } = useAuth();
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
  });

  // Generate a random secure password
  const generatePassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    // Ensure at least one of each required character type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special char
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  useEffect(() => {
    loadCoaches();
  }, []);

  const loadCoaches = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'coach')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const coachesList = (data || []).map((coach) => {
        const nameFromParts = [coach.first_name, coach.last_name].filter(Boolean).join(' ');
        return {
          id: coach.id,
          email: coach.email || 'N/A',
          fullName: nameFromParts || 'N/A',
          firstName: coach.first_name,
          lastName: coach.last_name,
          createdAt: coach.created_at,
        };
      });

      setCoaches(coachesList);
    } catch (error) {
      console.error('Error loading coaches:', error);
      Alert.alert('Error', 'Failed to load coaches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // VERY VISIBLE LOG TO CONFIRM FUNCTION IS CALLED
    console.log('🚀🚀🚀🚀🚀 BUTTON CLICKED - CREATE COACH 🚀🚀🚀🚀🚀');
    console.log('Form Data:', JSON.stringify(formData, null, 2));
    
    if (!formData.fullName.trim() || !formData.email.trim()) {
      console.log('❌ Validation failed: Empty fields');
      Alert.alert('Validation Error', 'Please fill in all fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      console.log('❌ Validation failed: Invalid email');
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return;
    }

    try {
      setSubmitting(true);
      console.log('✅ Validation passed, starting process...');
      const emailLower = formData.email.trim().toLowerCase();
      const nameParts = formData.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      console.log('🔍 [CREATE-COACH] Step 1: Looking for existing profile...', { email: emailLower });

      // Step 1: Check if profile exists
      const { data: existingProfile, error: lookupError } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('email', emailLower)
        .maybeSingle();

      console.log('📋 [CREATE-COACH] Profile lookup result:', { 
        found: !!existingProfile, 
        id: existingProfile?.id,
        currentRole: existingProfile?.role,
        error: lookupError 
      });

      let userId = null;

      if (existingProfile) {
        // Profile exists - update it
        userId = existingProfile.id;
        console.log('✅ [CREATE-COACH] Found existing profile, updating to coach role...');
        
        // CRITICAL: Update BOTH profile table AND user_metadata to ensure role is correct
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            first_name: firstName,
            last_name: lastName,
            role: 'coach', // CRITICAL: Set role to 'coach', NOT 'admin'
          })
          .eq('id', userId);

        if (updateError) {
          console.error('❌ [CREATE-COACH] Update error:', updateError);
          Alert.alert('Error', `Failed to update profile: ${updateError.message}\n\nCode: ${updateError.code}\nDetails: ${updateError.details || 'None'}`);
          return;
        }

        // Also update user_metadata to ensure consistency
        // Note: This requires admin access, so it might fail - that's OK, profile table is source of truth
        try {
          const { error: metadataError } = await supabase.auth.updateUser({
            data: {
              role: 'coach', // CRITICAL: Ensure user_metadata also says 'coach'
            },
          });
          if (metadataError) {
            console.warn('⚠️ [CREATE-COACH] Could not update user_metadata (this is OK):', metadataError);
          }
        } catch (e) {
          console.warn('⚠️ [CREATE-COACH] Could not update user_metadata:', e);
        }

        console.log('✅✅✅ [CREATE-COACH] SUCCESS - Profile updated to coach role!');
        Alert.alert(
          'Success',
          `Coach profile updated successfully!\n\nEmail: ${emailLower}\nName: ${formData.fullName.trim()}\n\nRole has been set to "coach" (NOT admin).`,
          [
            {
              text: 'OK',
              onPress: () => {
                setFormData({ fullName: '', email: '' });
                loadCoaches();
              },
            },
          ]
        );
        return;
      }

      // Profile doesn't exist - need to create user first
      console.log('⚠️ [CREATE-COACH] Profile not found, user needs to be created first');
      
      const coachPassword = generatePassword();
      
      Alert.alert(
        'User Account Required',
        `No user account found for ${emailLower}.\n\nTo create a coach:\n\n1. Click "Create User Account" below\n2. This will create the user account\n3. Then update their profile to coach role\n\nOR manually:\n1. Go to Supabase Dashboard → Auth → Users\n2. Click "Add User"\n3. Enter email and password\n4. Then come back and try again`,
        [
          {
            text: 'Create User Account',
            onPress: async () => {
              try {
                console.log('📝 [CREATE-COACH] Attempting to create user account...');
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                  email: emailLower,
                  password: coachPassword,
                  options: {
                    data: {
                      full_name: formData.fullName.trim(),
                      first_name: firstName,
                      last_name: lastName,
                      role: 'coach',
                    },
                  },
                });

                if (signUpError) {
                  console.error('❌ [CREATE-COACH] SignUp error:', signUpError);
                  Alert.alert('Error', `Failed to create user: ${signUpError.message}\n\nPlease create the user manually in Supabase Dashboard.`);
                  return;
                }

                if (!signUpData?.user?.id) {
                  Alert.alert('Error', 'User creation failed. Please try creating manually in Supabase Dashboard.');
                  return;
                }

                userId = signUpData.user.id;
                console.log('✅ [CREATE-COACH] User created:', userId);

                // Wait a moment for profile trigger to create profile
                console.log('⏳ Waiting for profile to be created by trigger...');
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Now update profile - CRITICAL: Set role to 'coach', NOT 'admin'
                console.log('📝 Updating profile to coach role...');
                const { error: profileError } = await supabase
                  .from('profiles')
                  .update({
                    first_name: firstName,
                    last_name: lastName,
                    role: 'coach', // CRITICAL: Set role to 'coach', NOT 'admin'
                  })
                  .eq('id', userId);

                if (profileError) {
                  console.error('❌ [CREATE-COACH] Profile update error:', profileError);
                  Alert.alert('Partial Success', `User created but profile update failed: ${profileError.message}\n\nUser ID: ${userId}\nPassword: ${coachPassword}`);
                  return;
                }

                // Also try to update user_metadata for consistency
                try {
                  const { error: metadataError } = await supabase.auth.updateUser({
                    data: {
                      role: 'coach', // CRITICAL: Ensure user_metadata also says 'coach'
                    },
                  });
                  if (metadataError) {
                    console.warn('⚠️ [CREATE-COACH] Could not update user_metadata (this is OK):', metadataError);
                  }
                } catch (e) {
                  console.warn('⚠️ [CREATE-COACH] Could not update user_metadata:', e);
                }

                console.log('✅✅✅ [CREATE-COACH] SUCCESS - User and profile created with coach role!');

                Alert.alert(
                  'Success!',
                  `Coach account created!\n\nEmail: ${emailLower}\nPassword: ${coachPassword}\n\n⚠️ IMPORTANT: Share this password with the coach. They may need to check their email for confirmation.`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        setFormData({ fullName: '', email: '' });
                        loadCoaches();
                      },
                    },
                  ]
                );
              } catch (error) {
                console.error('❌ [CREATE-COACH] Error:', error);
                Alert.alert('Error', error?.message || 'Failed to create user account.');
              }
            },
          },
          {
            text: 'Open Supabase Dashboard',
            onPress: () => {
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.open('https://supabase.com/dashboard/project/qdlzumzkhbnxpkprbuju/auth/users', '_blank');
              }
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } catch (error) {
      console.error('❌ [CREATE-COACH] Error:', error);
      Alert.alert('Error', error?.message || 'Failed to create coach. Check console for details.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadCoaches} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Coaches</Text>
          <Text style={styles.subtitle}>Manage coach accounts</Text>
        </View>
        {onNavigate && (
          <TouchableOpacity
            style={styles.dashboardBtn}
            onPress={() => onNavigate('admin-dashboard')}
            activeOpacity={0.7}
          >
            <Ionicons name="grid-outline" size={18} color="#0D9488" />
            <Text style={styles.dashboardBtnText}>Dashboard</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Add Coach Form */}
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Add New Coach</Text>
        <View style={styles.formRow}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter coach's full name"
            value={formData.fullName}
            onChangeText={(text) => setFormData({ ...formData, fullName: text })}
            editable={!submitting}
          />
        </View>
        <View style={styles.formRow}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter coach's email address"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!submitting}
          />
        </View>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={() => {
            console.error('🔴🔴🔴 BUTTON CLICKED DIRECTLY 🔴🔴🔴');
            window.alert('Button clicked! Check console.');
            handleSubmit();
          }}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Create Coach</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Coaches List */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>All Coaches</Text>
        <Text style={styles.listSubtitle}>{coaches.length} total coaches</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>Loading coaches...</Text>
        </View>
      ) : coaches.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyText}>No coaches found</Text>
          <Text style={styles.emptySubtext}>
            Add a new coach using the form above
          </Text>
        </View>
      ) : (
        coaches.map((coach) => (
          <View key={coach.id} style={styles.coachCard}>
            <View style={styles.coachHeader}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={24} color="#8E8E93" />
              </View>
              <View style={styles.coachInfo}>
                <Text style={styles.coachName}>{coach.fullName}</Text>
                <Text style={styles.coachEmail}>{coach.email}</Text>
              </View>
              <View style={styles.coachBadge}>
                <Ionicons name="shield-checkmark" size={20} color="#007AFF" />
                <Text style={styles.coachBadgeText}>Coach</Text>
              </View>
            </View>
            <View style={styles.coachMeta}>
              <Text style={styles.metaText}>
                Added: {formatDate(coach.createdAt)}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  dashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.3)',
  },
  dashboardBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D9488',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    }),
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
  },
  formRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listHeader: {
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  listSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 8,
    textAlign: 'center',
  },
  coachCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    }),
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  coachInfo: {
    flex: 1,
  },
  coachName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  coachEmail: {
    fontSize: 14,
    color: '#8E8E93',
  },
  coachBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  coachBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  coachMeta: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  metaText: {
    fontSize: 12,
    color: '#8E8E93',
  },
});
