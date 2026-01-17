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

export default function AdminCoachesScreen() {
  const { user } = useAuth();
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
  });

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
    if (!formData.fullName.trim() || !formData.email.trim()) {
      Alert.alert('Validation Error', 'Please fill in all fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return;
    }

    try {
      setSubmitting(true);

      // Call the database function instead of Edge Function
      const { data, error } = await supabase.rpc('create_coach_profile', {
        coach_email: formData.email.trim(),
        coach_full_name: formData.fullName.trim(),
      });

      if (error) {
        throw new Error(error.message || 'Failed to create coach profile');
      }

      if (!data || !data.success) {
        // User doesn't exist - show detailed instructions
        if (data?.instructions) {
          Alert.alert(
            'User Account Required',
            data.instructions,
            [
              {
                text: 'Open Supabase Dashboard',
                onPress: () => {
                  // Open Supabase dashboard in new tab
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.open('https://supabase.com/dashboard/project/qdlzumzkhbnxpkprbuju/auth/users', '_blank');
                  }
                },
              },
              {
                text: 'I\'ll Do It Later',
                style: 'cancel',
              },
            ]
          );
        } else {
          throw new Error(data?.error || 'Failed to create coach');
        }
        return;
      }

      // Success - profile created/updated
      Alert.alert(
        'Coach Profile Created',
        data.note || `Coach profile created successfully for ${data.email}.`,
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
      console.error('Error creating coach:', error);
      Alert.alert('Error', error.message || 'Failed to create coach. Please try again.');
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
        <Text style={styles.title}>Coaches</Text>
        <Text style={styles.subtitle}>Manage coach accounts</Text>
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
          onPress={handleSubmit}
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
