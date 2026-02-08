import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Zap, ChevronLeft, Search, Save, Clock, CheckCircle, TrendingUp } from 'lucide-react';
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
import { getStreak } from '../utils/playerData';
import { supabase } from '../lib/supabase';

const OPTIC_YELLOW = '#E3FF00';
const NAVY = '#05070A';
const GRID_LIGHT = '#E2E8F0';
const FONT_STACK = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO_FONT = "'IBM Plex Mono', 'JetBrains Mono', monospace";

const PREMIUM_ELEVATION = '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 10px 15px -3px rgba(0, 0, 0, 0.03)';

const SKILL_LABELS: { key: keyof typeof defaultSkills; label: string }[] = [
  { key: 'serve', label: 'Current Serve Level' },
  { key: 'forehand', label: 'Forehand' },
  { key: 'backhand', label: 'Backhand' },
  { key: 'volleys', label: 'Volleys' },
  { key: 'fitness', label: 'Movement / Fitness' },
  { key: 'consistency', label: 'Consistency' },
];

const defaultSkills = {
  serve: 0,
  forehand: 0,
  backhand: 0,
  volleys: 0,
  fitness: 0,
  consistency: 0,
};

interface Student {
  id: string;
  fullName: string;
  email: string;
}

interface AdminPerformancePageProps {
  onBack?: () => void;
}

export default function AdminPerformancePage({ onBack }: AdminPerformancePageProps) {
  const { userRole, user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [skills, setSkills] = useState(defaultSkills);
  const [baselineSkills, setBaselineSkills] = useState<Record<string, number> | null>(null);
  const [baselineAssessedAt, setBaselineAssessedAt] = useState<string | null>(null);
  const [focusArea, setFocusArea] = useState('');
  const [coachInsight, setCoachInsight] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [attendance, setAttendance] = useState<string[]>([]);
  const [bookings, setBookings] = useState<Array<{ start_time: string; end_time?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string } | null>(null);

  const isAdmin = userRole === 'admin';
  const isCoach = userRole === 'coach';
  const canAccess = isAdmin || isCoach;

  useEffect(() => {
    if (!canAccess) return;
    loadStudents();
  }, [canAccess]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('role', 'student')
        .order('first_name');

      if (error) throw error;

      const list = (data || []).map((p) => ({
        id: p.id,
        fullName: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Unknown',
        email: p.email || '',
      }));
      setStudents(list);
    } catch (err) {
      console.error('Error loading students:', err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentPerformance = useCallback(async (studentId: string) => {
    try {
      const { data } = await supabase
        .from('student_performance')
        .select('*')
        .eq('user_id', studentId)
        .maybeSingle();

      if (data?.skills) {
        setSkills({ ...defaultSkills, ...data.skills });
      } else {
        setSkills(defaultSkills);
      }
      setBaselineSkills(data?.baseline_skills ? { ...defaultSkills, ...data.baseline_skills } : null);
      setBaselineAssessedAt(data?.baseline_assessed_at ?? null);
      setFocusArea(data?.focus_area || '');
      setCoachInsight(data?.coach_insight || '');
      setLastUpdated(
        data?.last_updated
          ? new Date(data.last_updated).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : ''
      );
    } catch {
      setSkills(defaultSkills);
      setBaselineSkills(null);
      setBaselineAssessedAt(null);
      setFocusArea('');
      setCoachInsight('');
      setLastUpdated('');
    }

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('user_id', studentId);
    setBookings(bookingsData || []);
    const dates = (bookingsData || [])
      .map((b) => (b.start_time ? new Date(b.start_time).toISOString().slice(0, 10) : ''))
      .filter(Boolean);
    setAttendance(dates);
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      loadStudentPerformance(selectedStudent.id);
    } else {
      setSkills(defaultSkills);
      setBaselineSkills(null);
      setBaselineAssessedAt(null);
      setFocusArea('');
      setCoachInsight('');
      setLastUpdated('');
      setAttendance([]);
      setBookings([]);
    }
  }, [selectedStudent, loadStudentPerformance]);

  const handleSave = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      const payload = {
        user_id: selectedStudent.id,
        skills,
        focus_area: focusArea,
        coach_insight: coachInsight,
        last_updated: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('student_performance').upsert(payload, {
        onConflict: 'user_id',
      });

      if (error) throw error;

      setLastUpdated(
        new Date().toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      );
      setToast({ message: 'Student Performance Updated Successfully' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error('Save failed:', err);
      setToast({ message: 'Failed to save. Please try again.' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    return s.fullName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  const { streak } = getStreak(attendance);

  const totalHours =
    bookings.length > 0
      ? bookings.reduce((sum, b) => {
          if (!b.start_time || !b.end_time) return sum;
          const hrs = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / (1000 * 60 * 60);
          return sum + hrs;
        }, 0)
      : attendance.length * 1;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lessonsThisMonth = attendance.filter((d) => {
    const date = new Date(d + 'T12:00:00');
    return date >= monthStart && date <= monthEnd;
  }).length;
  const monthlyAttendance = Math.min(100, Math.round((lessonsThisMonth / 4) * 100));

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

  const RadarTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: (typeof radarData)[0] }> }) => {
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

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    boxShadow: PREMIUM_ELEVATION,
    border: '1px solid #F1F5F9',
  };

  if (!canAccess) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', padding: 40, fontFamily: FONT_STACK }}>
        <p style={{ color: NAVY }}>Access denied. Admin or Coach only.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', fontFamily: FONT_STACK }}>
      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: NAVY,
            color: '#fff',
            padding: '12px 24px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 500,
            zIndex: 9999,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
        >
          {toast.message}
        </motion.div>
      )}

      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 32px',
          borderBottom: '1px solid #f1f5f9',
          backgroundColor: '#fff',
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: NAVY,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <ChevronLeft style={{ width: 20, height: 20 }} />
          Back
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: NAVY, margin: 0 }}>Performance Management</h1>
        <div style={{ width: 80 }} />
      </header>

      <main style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
        {/* Student Search / Select */}
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: NAVY }}>Select Student</h2>
          <div
            style={{
              position: 'relative',
              marginBottom: 16,
            }}
          >
            <Search
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 18,
                height: 18,
                color: '#94a3b8',
              }}
            />
            <input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 12px 12px 44px',
                fontSize: 14,
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                outline: 'none',
              }}
            />
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filteredStudents.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStudent(s)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  textAlign: 'left',
                  border: 'none',
                  backgroundColor: selectedStudent?.id === s.id ? 'rgba(227,255,0,0.15)' : 'transparent',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  color: NAVY,
                  fontWeight: selectedStudent?.id === s.id ? 600 : 500,
                }}
              >
                {s.fullName} {s.email && <span style={{ color: '#94a3b8', fontWeight: 400 }}>({s.email})</span>}
              </button>
            ))}
          </div>
        </div>

        {!selectedStudent ? (
          <div
            style={{
              ...cardStyle,
              textAlign: 'center',
              padding: 48,
              color: '#94a3b8',
              fontSize: 15,
            }}
          >
            Select a student to view and edit their performance data.
          </div>
        ) : (
          <>
            {/* Streak header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 24,
              }}
            >
              <Zap style={{ width: 28, height: 28, color: OPTIC_YELLOW }} fill={OPTIC_YELLOW} />
              <div>
                <span style={{ fontSize: 32, fontWeight: 600, color: NAVY }}>{streak}</span>
                <span style={{ fontSize: 12, color: '#64748B', marginLeft: 8 }}>week streak</span>
              </div>
              <span style={{ fontSize: 14, color: '#94a3b8', marginLeft: 16 }}>{selectedStudent.fullName}</span>
            </div>

            {/* Spider + Sliders */}
            <div style={{ marginBottom: 24 }}>
              {/* Spider + Sliders */}
              <div style={cardStyle}>
                <h2 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 600, color: NAVY }}>Skills Profile</h2>
                <div style={{ display: 'flex', gap: 24 }}>
                  <div style={{ flex: 1, minWidth: 0, height: 260 }}>
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
                  <div style={{ flex: '0 0 180px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {SKILL_LABELS.map(({ key, label }) => (
                      <div key={key}>
                        <label style={{ fontSize: 11, fontWeight: 500, color: '#64748B', display: 'block', marginBottom: 4 }}>
                          {label}
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          value={skills[key]}
                          onChange={(e) => setSkills((s) => ({ ...s, [key]: Number(e.target.value) }))}
                          style={{
                            width: '100%',
                            accentColor: OPTIC_YELLOW,
                          }}
                        />
                        <span style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{skills[key]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Stats Row */}
            <div className="perf-activity-stats">
              <div className="perf-activity-stat-card">
                <div className="perf-stat-icon">
                  <Clock style={{ width: 24, height: 24, color: OPTIC_YELLOW }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="perf-stat-value" style={{ fontSize: 28, fontWeight: 700, color: NAVY, lineHeight: 1.2 }}>{totalHours.toFixed(1)}</div>
                  <div className="perf-stat-label" style={{ fontSize: 12, fontWeight: 500, color: '#64748B', marginTop: 4 }}>Total Hours</div>
                </div>
              </div>
              <div className="perf-activity-stat-card">
                <div className="perf-stat-icon">
                  <CheckCircle style={{ width: 24, height: 24, color: OPTIC_YELLOW }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="perf-stat-value" style={{ fontSize: 28, fontWeight: 700, color: NAVY, lineHeight: 1.2 }}>{monthlyAttendance}%</div>
                  <div className="perf-stat-label" style={{ fontSize: 12, fontWeight: 500, color: '#64748B', marginTop: 4 }}>Monthly Attendance</div>
                </div>
              </div>
              <div className="perf-activity-stat-card">
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
              </div>
            </div>

            {/* Coach's Insight - Signed Technical Memo */}
            <div style={{ ...cardStyle, position: 'relative' }}>
              <h2 style={{ margin: '0 0 24px', fontSize: 15, fontWeight: 600, color: NAVY }}>Coach's Insight</h2>
              <div className="perf-coach-insight-layout" style={{ gap: 32 }}>
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
                    <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', display: 'block', marginBottom: 8 }}>
                      Focus Area
                    </label>
                    <input
                      type="text"
                      value={focusArea}
                      onChange={(e) => setFocusArea(e.target.value)}
                      placeholder="e.g. Forehand Recovery"
                      className="perf-focus-pill-input"
                      style={{
                        width: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                        padding: '8px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        border: 'none',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', display: 'block' }}>
                      Last Updated
                    </span>
                    <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: '#64748B' }}>{lastUpdated || '—'}</div>
                  </div>
                </div>
                <div className="perf-coach-memo-body" style={{ position: 'relative', zIndex: 1 }}>
                  <textarea
                    value={coachInsight}
                    onChange={(e) => setCoachInsight(e.target.value)}
                    placeholder="Add technical feedback and notes for this student..."
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
                      resize: 'vertical',
                      fontFamily: "'Source Serif Pro', Georgia, serif",
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Save FAB */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                position: 'fixed',
                bottom: 32,
                right: 32,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 24px',
                backgroundColor: OPTIC_YELLOW,
                color: NAVY,
                border: 'none',
                borderRadius: 16,
                fontSize: 15,
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 20px rgba(227,255,0,0.4)',
                opacity: saving ? 0.8 : 1,
              }}
            >
              <Save style={{ width: 20, height: 20 }} />
              {saving ? 'Saving...' : 'Save Progress'}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
