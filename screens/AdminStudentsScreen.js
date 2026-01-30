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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export default function StudentsScreen({ onNavigate }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      
      // Get all profiles (students have role in user_metadata, but we'll get from profiles)
      // Note: We'll get profiles and match with auth.users via RPC or direct query
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // For each profile, we need to get the user email from auth.users
      // Since we can't directly query auth.users, we'll use the email from profiles
      // or create a function to get user data
      const studentsList = profiles.map((profile) => {
        const nameFromParts = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
        return {
          id: profile.id,
          email: profile.email || 'N/A',
          phone: profile.phone || null,
          fullName: nameFromParts || profile.full_name || 'N/A',
          createdAt: profile.created_at,
          emailVerified: true, // Assume verified if profile exists
        };
      });

      setStudents(studentsList);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter((student) => {
    const query = searchQuery.toLowerCase();
    return (
      student.email.toLowerCase().includes(query) ||
      student.fullName.toLowerCase().includes(query)
    );
  });

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
        <RefreshControl refreshing={loading} onRefresh={loadStudents} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Students</Text>
          <Text style={styles.subtitle}>{students.length} total students</Text>
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

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search students..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          fontSize={16}
        />
      </View>

      {filteredStudents.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyText}>No students found</Text>
        </View>
      ) : (
        filteredStudents.map((student) => (
          <View key={student.id} style={styles.studentCard}>
            <View style={styles.studentHeader}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={24} color="#8E8E93" />
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.fullName}</Text>
                <Text style={styles.studentEmail}>{student.email}</Text>
                {student.phone && (
                  <View style={styles.phoneRow}>
                    <Ionicons name="call-outline" size={12} color="#8E8E93" />
                    <Text style={styles.studentPhone}>{student.phone}</Text>
                  </View>
                )}
              </View>
              {student.emailVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                </View>
              )}
            </View>
            <View style={styles.studentMeta}>
              <Text style={styles.metaText}>
                Joined: {formatDate(student.createdAt)}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  studentCard: {
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
  studentHeader: {
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
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: 14,
    color: '#8E8E93',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  studentPhone: {
    fontSize: 13,
    color: '#6B7280',
  },
  verifiedBadge: {
    marginLeft: 8,
  },
  studentMeta: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  metaText: {
    fontSize: 12,
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
});
