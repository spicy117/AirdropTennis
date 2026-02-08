/**
 * Player data type definitions for Airdrop Tennis
 * Used for student progress, skills, attendance, badges, and roadmap.
 */

export interface PlayerSkills {
  serve: number;
  forehand: number;
  backhand: number;
  volleys: number;
  fitness: number;
  consistency: number;
}

export interface PlayerBadge {
  id: string;
  name: string;
  icon: string;
  unlocked: boolean;
  description: string;
}

export type RoadmapStatus = 'mastered' | 'in-progress' | 'locked';

export interface RoadmapGoal {
  task: string;
  status: RoadmapStatus;
}

export interface PlayerData {
  skills: PlayerSkills;
  attendance: string[]; // ISO date strings (YYYY-MM-DD)
  badges: PlayerBadge[];
  roadmap: RoadmapGoal[];
}
