import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Clock, TrendingUp } from 'lucide-react';
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

const OPTIC_YELLOW = '#D4F934';
const NAVY = '#141414';
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
  const { user } = useAuth();
  const [skills, setSkills] = useState(defaultSkills);
  const [baselineSkills, setBaselineSkills] = useState<Record<string, number> | null>(null);
  const [attendance, setAttendance] = useState<string[]>([]);
  const [bookings, setBookings] = useState<Array<{ start_time: string; end_time?: string }>>([]);
  const [loading, setLoading] = useState(true);

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
          .select('skills, baseline_skills')
          .eq('user_id', user.id)
          .maybeSingle();

        if (perf?.skills) {
          setSkills({ ...defaultSkills, ...perf.skills });
        } else {
          setSkills(playerData.skills);
        }
        setBaselineSkills(perf?.baseline_skills ? { ...defaultSkills, ...perf.baseline_skills } : null);
      } catch {
        setSkills(playerData.skills);
        setBaselineSkills(null);
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

  const skillKeys = ['serve', 'forehand', 'backhand', 'volleys', 'fitness', 'consistency'] as const;
  const subjectLabels: Record<string, string> = { serve: 'Serve', forehand: 'Forehand', backhand: 'Backhand', volleys: 'Volleys', fitness: 'Fitness', consistency: 'Consistency' };
  const radarData = skillKeys.map((key) => ({
    subject: subjectLabels[key],
    key,
    value: skills[key],
    baseline: baselineSkills ? baselineSkills[key] ?? 0 : skills[key],
    fullMark: 10,
  }));

  const formatSkillScore = (n: number) => String(Math.round(Number(n) || 0));

  const strongestSkill = radarData.reduce((best, cur) => (cur.value > best.value ? cur : best), radarData[0]);
  const focusSkill = radarData.reduce((weak, cur) => (cur.value < weak.value ? cur : weak), radarData[0]);

  const RadarTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof radarData[0] }> }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div
        className="perf-radar-tooltip"
        style={{
          backgroundColor: NAVY,
          color: '#fff',
          padding: '8px 12px',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          whiteSpace: 'nowrap',
        }}
      >
        {d.subject} · {formatSkillScore(d.value)} / 10
      </div>
    );
  };

  const RadarAngleTick = ({
    payload,
    x,
    y,
    cx,
    cy,
  }: {
    payload?: { value?: string };
    x?: number;
    y?: number;
    cx?: number;
    cy?: number;
  }) => {
    if (x == null || y == null || cx == null || cy == null || !payload?.value) return null;
    const item = radarData.find((d) => d.subject === payload.value);
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const push = 18;
    const nx = cx + (dx / dist) * (dist + push);
    const ny = cy + (dy / dist) * (dist + push);
    let anchor: 'start' | 'middle' | 'end' = 'middle';
    if (nx > cx + 10) anchor = 'start';
    else if (nx < cx - 10) anchor = 'end';
    return (
      <text
        x={nx}
        y={ny}
        textAnchor={anchor}
        dominantBaseline="middle"
        fill={NAVY}
        fontSize={12}
        fontWeight={600}
        style={{ fontFamily: FONT_STACK }}
      >
        {payload.value} {formatSkillScore(item?.value ?? 0)}
      </text>
    );
  };

  const currentAvg = skillKeys.reduce((s, k) => s + skills[k], 0) / 6;
  const baselineAvg = baselineSkills
    ? skillKeys.reduce((s, k) => s + (baselineSkills[k] ?? 0), 0) / 6
    : currentAvg;
  const skillGain = Math.round(currentAvg - baselineAvg);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#F6F4EF',
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
        backgroundColor: '#F6F4EF',
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
          overflow: 'hidden',
        }}
      >
        <div className="perf-court-watermark" aria-hidden />
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
            aria-hidden
            style={{ fontSize: 32, lineHeight: 1, filter: 'none' }}
          >
            🔥
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
            <div className="perf-radar-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  data={radarData}
                  outerRadius="68%"
                  margin={{ top: 36, right: 48, bottom: 36, left: 48 }}
                >
                  <PolarGrid
                    gridType="circle"
                    stroke={GRID_LIGHT}
                    strokeWidth={1}
                    radialLines
                  />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={(props) => <RadarAngleTick {...props} />}
                    tickFormatter={(label: string) => {
                      const item = radarData.find((d) => d.subject === label);
                      return `${label} ${formatSkillScore(item?.value ?? 0)}`;
                    }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 10]}
                    ticks={[2, 4, 6, 8, 10]}
                    axisLine={false}
                    tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }}
                  />
                  <Tooltip
                    content={<RadarTooltip />}
                    cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                    trigger="hover"
                  />
                  <Radar
                    name="Baseline"
                    dataKey="baseline"
                    stroke="#94a3b8"
                    fill="none"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    isAnimationActive={false}
                  />
                  <Radar
                    name="Current"
                    dataKey="value"
                    stroke={OPTIC_YELLOW}
                    fill={OPTIC_YELLOW}
                    fillOpacity={0.32}
                    strokeWidth={2.5}
                    isAnimationActive={false}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="perf-radar-summaries">
              <div className="perf-radar-summary">
                <span className="perf-radar-summary-label">Strongest skill</span>
                <span className="perf-radar-summary-value">
                  {strongestSkill.subject} {formatSkillScore(strongestSkill.value)}
                </span>
              </div>
              <div className="perf-radar-summary">
                <span className="perf-radar-summary-label">Focus area</span>
                <span className="perf-radar-summary-value">
                  {focusSkill.subject} {formatSkillScore(focusSkill.value)}
                </span>
              </div>
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
                {Math.round(totalHours)}
              </div>
              <div className="perf-stat-label" style={{ fontSize: 12, fontWeight: 500, color: '#64748B', marginTop: 4 }}>Total Hours</div>
            </div>
          </motion.article>

          {/* Card 2: Skill Gain */}
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
      </main>
    </div>
  );
}
