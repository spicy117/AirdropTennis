import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, ChevronLeft, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import '../styles/performance.css';
import { useAuth } from '../contexts/AuthContext';
import { playerData, getStreak } from '../utils/playerData';
import { supabase } from '../lib/supabase';

const OPTIC_YELLOW = '#E3FF00';
const NAVY = '#0F172A';
const GRID_LIGHT = '#E2E8F0';
const FONT_STACK = "'Inter', 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO_FONT = "'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', 'Monaco', monospace";

const PREMIUM_ELEVATION = '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 10px 15px -3px rgba(0, 0, 0, 0.03)';

const defaultSkills = {
  serve: 0,
  forehand: 0,
  backhand: 0,
  volleys: 0,
  fitness: 0,
  consistency: 0,
};

interface PerformancePageProps {
  onBack?: () => void;
}

export default function PerformancePage({ onBack }: PerformancePageProps) {
  const { userRole, user } = useAuth();
  const [skills, setSkills] = useState(defaultSkills);
  const [baselineSkills, setBaselineSkills] = useState<Record<string, number> | null>(null);
  const [baselineAssessedAt, setBaselineAssessedAt] = useState<string | null>(null);
  const [focusArea, setFocusArea] = useState('');
  const [coachInsight, setCoachInsight] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [attendance, setAttendance] = useState<string[]>([]);
  const [bookings, setBookings] = useState<Array<{ start_time: string; end_time?: string }>>([]);
  const [loading, setLoading] = useState(true);

  const canEditInsight = userRole === 'coach' || userRole === 'admin';

  useEffect(() => {
    if (!user?.id) {
      setSkills(playerData.skills);
      setAttendance(playerData.attendance);
      setLoading(false);
      return;
    }

    const loadPerformance = async () => {
      try {
        const { data: perf } = await supabase
          .from('student_performance')
          .select('skills, baseline_skills, baseline_assessed_at, focus_area, coach_insight, last_updated')
          .eq('user_id', user.id)
          .maybeSingle();

        if (perf?.skills) {
          setSkills({ ...defaultSkills, ...perf.skills });
        } else {
          setSkills(playerData.skills);
        }
        setBaselineSkills(perf?.baseline_skills ? { ...defaultSkills, ...perf.baseline_skills } : null);
        setBaselineAssessedAt(perf?.baseline_assessed_at ?? null);
        setFocusArea(perf?.focus_area ?? '');
        setCoachInsight(perf?.coach_insight ?? '');
        setLastUpdated(
          perf?.last_updated
            ? new Date(perf.last_updated).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : ''
        );
      } catch {
        setSkills(playerData.skills);
        setBaselineSkills(null);
        setBaselineAssessedAt(null);
        setFocusArea('');
        setCoachInsight('');
        setLastUpdated('');
      }

      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('start_time, end_time')
        .eq('user_id', user.id);
      setBookings(bookingsData || []);
      const dates = (bookingsData || [])
        .map((b) => (b.start_time ? new Date(b.start_time).toISOString().slice(0, 10) : ''))
        .filter(Boolean);
      setAttendance(dates.length > 0 ? dates : playerData.attendance);
    };

    loadPerformance().finally(() => setLoading(false));
  }, [user?.id]);

  const { streak } = getStreak(attendance);

  const totalHours =
    bookings.length > 0
      ? bookings.reduce((sum, b) => {
          if (!b.start_time || !b.end_time) return sum;
          const hrs = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / (1000 * 60 * 60);
          return sum + hrs;
        }, 0)
      : attendance.length * 1; // estimate 1 hr/lesson when no booking data

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lessonsThisMonth = attendance.filter((d) => {
    const date = new Date(d + 'T12:00:00');
    return date >= monthStart && date <= monthEnd;
  }).length;
  const weeksInMonth = Math.ceil((monthEnd.getDate() - monthStart.getDate() + 1) / 7);
  const monthlyAttendance = weeksInMonth > 0 ? Math.min(100, Math.round((lessonsThisMonth / 4) * 100)) : 0;

  const skillKeys = ['serve', 'forehand', 'backhand', 'volleys', 'fitness', 'consistency'] as const;
  const subjectLabels: Record<string, string> = { serve: 'Serve', forehand: 'Forehand', backhand: 'Backhand', volleys: 'Volleys', fitness: 'Fitness', consistency: 'Consistency' };
  const radarData = skillKeys.map((key) => ({
    subject: subjectLabels[key],
    key,
    value: skills[key],
    baseline: baselineSkills ? baselineSkills[key] ?? 0 : skills[key],
    fullMark: 10,
  }));

  const baselineDateStr = baselineAssessedAt
    ? new Date(baselineAssessedAt).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
    : 'baseline';

  const RadarTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof radarData[0] }> }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const improvement = d.value - d.baseline;
    const sign = improvement >= 0 ? '+' : '';
    return (
      <div
        style={{
          backgroundColor: NAVY,
          color: '#fff',
          padding: '10px 14px',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.subject}</div>
        <div style={{ opacity: 0.9 }}>
          {sign}{improvement} pts since {baselineDateStr}
        </div>
      </div>
    );
  };

  const currentAvg = skillKeys.reduce((s, k) => s + skills[k], 0) / 6;
  const baselineAvg = baselineSkills
    ? skillKeys.reduce((s, k) => s + (baselineSkills[k] ?? 0), 0) / 6
    : currentAvg;
  const skillGain = Math.round((currentAvg - baselineAvg) * 10) / 10;

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#F9FAFB',
          fontFamily: FONT_STACK,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 14, color: '#64748B' }}>Loading performance...</span>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        fontFamily: FONT_STACK,
      }}
    >
      {/* Header: Clean, centered streak counter */}
      <header
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 32px 40px',
        }}
      >
        <button
          onClick={onBack}
          style={{
            position: 'absolute',
            left: 24,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#fff',
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            border: 'none',
          }}
          aria-label="Back"
        >
          <ChevronLeft style={{ width: 20, height: 20, color: NAVY }} />
        </button>

        <motion.div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            animate={{
              filter: [
                'drop-shadow(0 0 6px rgba(227,255,0,0.5))',
                'drop-shadow(0 0 12px rgba(227,255,0,0.7))',
                'drop-shadow(0 0 6px rgba(227,255,0,0.5))',
              ],
            }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            <Zap style={{ width: 28, height: 28, color: OPTIC_YELLOW }} fill={OPTIC_YELLOW} />
          </motion.div>
          <div style={{ textAlign: 'center' }}>
            <span
              style={{
                fontSize: 40,
                fontWeight: 600,
                letterSpacing: '-0.04em',
                color: NAVY,
                display: 'block',
                lineHeight: 1.1,
              }}
            >
              {streak}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: '#64748B',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              week streak
            </span>
          </div>
        </motion.div>
      </header>

      {/* Main Row: Spider + Activity Stats */}
      <main style={{ padding: '0 32px 56px', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          {/* Spider Chart */}
          <motion.article
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 32,
              boxShadow: PREMIUM_ELEVATION,
              border: '1px solid #F1F5F9',
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2
              style={{
                margin: '0 0 24px',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: NAVY,
              }}
            >
              Skills Profile
            </h2>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke={GRID_LIGHT} />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: NAVY, fontSize: 11, fontWeight: 600 }}
                  />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip content={<RadarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Radar
                    name="Baseline"
                    dataKey="baseline"
                    stroke="#94a3b8"
                    fill="none"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                  <Radar
                    name="Current"
                    dataKey="value"
                    stroke={OPTIC_YELLOW}
                    fill={OPTIC_YELLOW}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.article>
        </div>

        {/* Activity Stats Row */}
        <div className="perf-activity-stats">
          {/* Card 1: Total Hours */}
          <motion.article
            className="perf-activity-stat-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="perf-stat-icon">
              <Clock style={{ width: 24, height: 24, color: OPTIC_YELLOW }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="perf-stat-value" style={{ fontSize: 28, fontWeight: 700, color: NAVY, lineHeight: 1.2 }}>
                {totalHours.toFixed(1)}
              </div>
              <div className="perf-stat-label" style={{ fontSize: 12, fontWeight: 500, color: '#64748B', marginTop: 4 }}>Total Hours</div>
            </div>
          </motion.article>

          {/* Card 2: Monthly Attendance */}
          <motion.article
            className="perf-activity-stat-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="perf-stat-icon">
              <CheckCircle style={{ width: 24, height: 24, color: OPTIC_YELLOW }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="perf-stat-value" style={{ fontSize: 28, fontWeight: 700, color: NAVY, lineHeight: 1.2 }}>
                {monthlyAttendance}%
              </div>
              <div className="perf-stat-label" style={{ fontSize: 12, fontWeight: 500, color: '#64748B', marginTop: 4 }}>Monthly Attendance</div>
            </div>
          </motion.article>

          {/* Card 3: Skill Gain */}
          <motion.article
            className="perf-activity-stat-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="perf-stat-icon">
              <TrendingUp style={{ width: 24, height: 24, color: OPTIC_YELLOW }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: skillGain >= 0 ? '#22C55E' : '#94a3b8',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {skillGain >= 0 ? '+' : ''}{skillGain} Overall
              </span>
              <div className="perf-stat-label" style={{ fontSize: 12, fontWeight: 500, color: '#64748B', marginTop: 8 }}>Skill Gain</div>
            </div>
          </motion.article>
        </div>

        {/* Coach's Insight - Signed Technical Memo */}
        <motion.article
          className="perf-coach-insight-card"
          style={{
            position: 'relative',
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 32,
            boxShadow: PREMIUM_ELEVATION,
            border: '1px solid #F1F5F9',
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2
            style={{
              margin: '0 0 24px',
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: NAVY,
            }}
          >
            Coach's Insight
          </h2>
          <div className="perf-coach-insight-layout" style={{ gap: 32 }}>
            {/* Left (25%): Focus Area pill + Last Updated */}
            <div
              className="perf-coach-meta"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                paddingRight: 24,
                borderRight: '1px solid #f1f5f9',
              }}
            >
              <div>
                <span className="perf-focus-pill">{focusArea || '—'}</span>
              </div>
              <div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#94a3b8',
                    display: 'block',
                  }}
                >
                  Last Updated
                </span>
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: '#64748B' }}>{lastUpdated || '—'}</div>
              </div>
            </div>
            {/* Right (75%): Memo body - serif, 1.6 line height */}
            <div className="perf-coach-memo-body" style={{ position: 'relative', zIndex: 1 }}>
              <textarea
                value={coachInsight}
                onChange={canEditInsight ? (e) => setCoachInsight(e.target.value) : undefined}
                readOnly={!canEditInsight}
                placeholder={
                  canEditInsight
                    ? 'Add technical feedback and notes for this student...'
                    : 'Technical feedback and notes from your coach will appear here.'
                }
                className="perf-memo-body"
                style={{
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  minHeight: 180,
                  padding: 20,
                  lineHeight: 1.6,
                  fontSize: 15,
                  color: NAVY,
                  backgroundColor: 'rgba(248, 250, 252, 0.5)',
                  border: '1px solid #f1f5f9',
                  borderRadius: 16,
                  resize: canEditInsight ? 'vertical' : 'none',
                  fontFamily: "'Source Serif Pro', Georgia, serif",
                  outline: 'none',
                  cursor: canEditInsight ? 'text' : 'default',
                }}
              />
            </div>
          </div>
        </motion.article>
      </main>
    </div>
  );
}
