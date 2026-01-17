/**
 * Database type definitions for the application
 * These types reflect the database schema including the updated profiles.role
 * and bookings.coach_id fields.
 */

export type ProfileRole = 'student' | 'coach' | 'admin';

export interface Profile {
  id: string; // UUID
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: ProfileRole;
  created_at?: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
}

export interface Booking {
  id: string; // UUID
  user_id: string; // UUID - references auth.users(id)
  location_id: string; // UUID - references locations(id)
  start_time: string; // ISO timestamp
  end_time: string; // ISO timestamp
  credit_cost: number;
  service_name: string | null;
  coach_id: string | null; // UUID - optional reference to profiles.id (coach or admin)
  created_at?: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
}

export interface BookingWithRelations extends Booking {
  locations?: {
    id: string;
    name: string;
  };
  coach?: Profile | null; // Optional coach profile
}

export interface Location {
  id: string; // UUID
  name: string;
  // Add other location fields as needed
}
