import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, BarChart, Bar, Legend,
} from 'recharts';
import { Activity, TrendingUp, BarChart3, ArrowLeftRight } from 'lucide-react';
import { Page } from '../App';
import { getSessionById, getDiagnosticSessions } from '../utils/api';
import type { DiagnosticSession } from '../types/session';

interface AnalyticsProps {
  onNavigate?: (page: Page) => void;
  sessionId?: string | null;
}

// Derive pattern type from actual frequency — never hardcode "Resting"
function patternType(freq: number): string {
  if (freq <= 0) return 'No tremor';
  if (freq >= 3 && freq <= 7)  return 'Parkinsonian';
  if (freq > 7  && freq <= 12) return 'Essential';
  return 'Indeterminate';
}

function patternColor(freq: number): string {
  if (freq <= 0) return 'text-gray-500';
  if (freq >= 3 && freq <= 7)  return 'text-orange-600';
  if (freq > 7  && freq <= 12) return 'text-blue-600';
  return 'text-yellow-600';
}

// Pick dominant label — same logic as Diagnostic.tsx & History.tsx
function sessionLabel(session: DiagnosticSession): string {
  if (session.label) return session.label;
  const l = session.leftHand;
  const r = session.rightHand;
  if (!l && !r) return 'No tremor detected';
  if (!l) return r!.label;
  if (!r) return l.label;
  return l.amplitude >= r.amplitude ? l.label : r.label;
}

const Analytics = ({ sessionId }: AnalyticsProps) => {
  const [sessionData, setSessionData] = useState<DiagnosticSession | null>(null);
  const [totalSessions, setTotalSessions] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const all = await getDiagnosticSessions();
        setTotalSessions(all.length);
        if (sessionId) {
          const session = await getSessionById(sessionId);
          setSessionData(session);
        }
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#004F7E] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // ── No sessions ──────────────────────────────────────────────────────────
  if (totalSessions === 0) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-16 text-center max-w-2xl">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Activity className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">No Reports Available</h2>
          <p className="text-lg text-gray-600 mb-8">
            Complete a diagnostic session to view analytics and tremor analysis data.
          </p>
          <button onClick={() => window.location.reload()} className="btn-primary text-lg px-8 py-4">
            Create New Report
          </button>
        </motion.div>
      </div>
    );
  }

  // ── No session selected ──────────────────────────────────────────────────
  if (!sessionData) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-16 text-center max-w-2xl">
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-12 h-12 text-[#004F7E]" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Select a Report to View Analytics</h2>
          <p className="text-lg text-gray-600 mb-8">
            Go to Lab Results and click "View Report" on any session to see detailed analytics.
          </p>
          <div className="text-sm text-gray-500">
            <p className="font-mono">{totalSessions} report(s) available</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Data prep ────────────────────────────────────────────────────────────
  const currentData =
    sessionData.spectrogramData && sessionData.spectrogramData.length > 0
      ? sessionData.spectrogramData
      : null;   // ← null means no real data — show a message instead of fake curve

  const peakData = currentData
    ? currentData.reduce((max, item) => item.amplitude > max.amplitude ? item : max)
    : null;

  const displayFrequency = sessionData.frequency || peakData?.frequency || 0;
  const displayAmplitude  = sessionData.amplitude  || peakData?.amplitude  || 0;

  const asymmetry = sessionData.asymmetry;
  const leftHand  = sessionData.leftHand;
  const rightHand = sessionData.rightHand;

  const handComparisonData = (leftHand || rightHand) ? [
    { name: 'Frequency (Hz)', Left: leftHand?.frequency ?? 0, Right: rightHand?.frequency ?? 0 },
    { name: 'Amplitude',      Left: leftHand?.amplitude  ?? 0, Right: rightHand?.amplitude  ?? 0 },
  ] : [];

  const pType  = patternType(displayFrequency);
  const pColor = patternColor(displayFrequency);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[#004F7E] mb-2">Trend Analytics</h1>
        <p className="text-gray-600 text-lg">
          Analysis for Patient {sessionData.patientId} —{' '}
          {new Date(sessionData.date).toLocaleDateString()}
        </p>
      </div>

      {/* ── Top metric cards ── */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="grid md:grid-cols-4 gap-6 mb-8">

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-[#004F7E]/20">
              <TrendingUp className="w-6 h-6 text-[#004F7E]" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-semibold">Peak Frequency</p>
              <p className="text-3xl font-bold font-mono text-[#004F7E]">
                {displayFrequency.toFixed(1)} Hz
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            {sessionData.method === 'live-camera' ? 'Live Camera' : 'Video Upload'}
          </p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-purple-100">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-semibold">Peak Amplitude</p>
              <p className="text-3xl font-bold font-mono text-purple-600">
                {displayAmplitude.toFixed(2)}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600">Confidence: {sessionData.confidence}%</p>
        </div>

        {/* ── FIX: Pattern Type — derived from real frequency, not hardcoded ── */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-green-100">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-semibold">Pattern Type</p>
              <p className={`text-2xl font-bold ${pColor}`}>{pType}</p>
            </div>
          </div>
          {/* ── FIX: label — uses sessionLabel() not leftHand-first fallback ── */}
          <p className="text-sm text-gray-600">{sessionLabel(sessionData)}</p>
        </div>

        {/* Asymmetry summary card */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-purple-100">
              <ArrowLeftRight className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-semibold">Asymmetry</p>
              <p className={`text-3xl font-bold font-mono
                ${!asymmetry ? 'text-gray-400'
                  : asymmetry.percent < 10 ? 'text-green-600'
                  : asymmetry.percent < 25 ? 'text-yellow-600'
                  : 'text-red-600'}`}>
                {asymmetry ? `${asymmetry.percent.toFixed(1)}%` : 'N/A'}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            {asymmetry
              ? asymmetry.dominant === 'Symmetric'
                ? 'Bilateral'
                : `${asymmetry.dominant} dominant`
              : 'Single hand detected'}
          </p>
        </div>
      </motion.div>

      {/* ── Frequency Spectrogram ── */}
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }} className="glass-card p-8 mb-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Frequency Spectrogram</h2>
          <p className="text-gray-600">
            {currentData
              ? 'Real FFT data from video analysis'
              : 'No spectrogram data available for this session'}
          </p>
        </div>

        {/* ── FIX: only render chart if we have real data — no fake default curve ── */}
        {currentData ? (
          <div className="h-80">
            <ResponsiveContainer
  width="100%"
  height={300}
  initialDimension={{ width: 1, height: 1 }}
>
              <AreaChart data={currentData}>
                <defs>
                  <linearGradient id="gradientResting" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#004F7E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#004F7E" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="frequency"
                  label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -5 }}
                  stroke="#6b7280" style={{ fontSize: '13px', fontWeight: 600 }} />
                <YAxis
                  label={{ value: 'Amplitude', angle: -90, position: 'insideLeft' }}
                  stroke="#6b7280" style={{ fontSize: '13px', fontWeight: 600 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '2px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
                  formatter={(value) => [`${Number(value).toFixed(3)}`, 'Amplitude']}
                  labelFormatter={(label) => `Frequency: ${label} Hz`}
                />
                <Area type="monotone" dataKey="amplitude"
                  stroke="#004F7E" strokeWidth={3}
                  fill="url(#gradientResting)" animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400 font-semibold">No FFT data recorded for this session</p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#004F7E]" />
            <span className="font-semibold text-gray-700">Amplitude Response</span>
          </div>
          <span className="text-gray-600">
            Peak at{' '}
            <span className="font-mono font-bold text-[#004F7E]">{displayFrequency.toFixed(1)} Hz</span>
          </span>
        </div>
      </motion.div>

      {/* ── Per-hand bar chart ── */}
      {handComparisonData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }} className="glass-card p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Left vs Right Hand</h2>
          <p className="text-gray-600 mb-6">Per-hand frequency and amplitude comparison</p>
          <div className="h-56">
            <ResponsiveContainer
  width="100%"
  height={300}
  initialDimension={{ width: 1, height: 1 }}
>
              <BarChart data={handComparisonData} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '13px' }} />
                <YAxis stroke="#6b7280" style={{ fontSize: '13px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                  formatter={(value) => [Number(value).toFixed(2), '']}
                />
                <Legend />
                <Bar dataKey="Left"  fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Right" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            {leftHand && (
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <p className="text-xs uppercase font-bold text-green-700 mb-2">Left Hand</p>
                <p className="text-2xl font-bold font-mono text-green-800">
                  {leftHand.frequency.toFixed(1)} Hz
                </p>
                <p className="text-sm text-gray-600 mt-1">{leftHand.label}</p>
                <p className="text-xs text-gray-500 mt-1">Amplitude: {leftHand.amplitude.toFixed(3)}</p>
              </div>
            )}
            {rightHand && (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-xs uppercase font-bold text-blue-700 mb-2">Right Hand</p>
                <p className="text-2xl font-bold font-mono text-blue-800">
                  {rightHand.frequency.toFixed(1)} Hz
                </p>
                <p className="text-sm text-gray-600 mt-1">{rightHand.label}</p>
                <p className="text-xs text-gray-500 mt-1">Amplitude: {rightHand.amplitude.toFixed(3)}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Asymmetry Index ── */}
      {asymmetry && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }} className="glass-card p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Asymmetry Index</h2>
          <p className="text-gray-600 mb-6">Bilateral tremor distribution analysis</p>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-5 bg-purple-50 rounded-xl border border-purple-200">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Index Value</p>
              <p className="text-4xl font-bold font-mono text-purple-700">
                {asymmetry.value.toFixed(3)}
              </p>
              <p className="text-xs text-gray-500 mt-1">–1 to +1 scale</p>
            </div>
            <div className="text-center p-5 bg-purple-50 rounded-xl border border-purple-200">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Asymmetry %</p>
              <p className={`text-4xl font-bold font-mono
                ${asymmetry.percent < 10 ? 'text-green-600'
                  : asymmetry.percent < 25 ? 'text-yellow-600'
                  : 'text-red-600'}`}>
                {asymmetry.percent.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {asymmetry.percent < 10 ? 'Symmetric'
                  : asymmetry.percent < 25 ? 'Mild asymmetry'
                  : 'Significant asymmetry'}
              </p>
            </div>
            <div className="text-center p-5 bg-purple-50 rounded-xl border border-purple-200">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Dominant Side</p>
              <p className={`text-4xl font-bold
                ${asymmetry.dominant === 'Symmetric' ? 'text-green-600' : 'text-purple-700'}`}>
                {asymmetry.dominant}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {asymmetry.dominant === 'Symmetric' ? 'Bilateral tremor' : 'Higher amplitude side'}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Right dominant</span><span>Symmetric</span><span>Left dominant</span>
            </div>
            <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
              <div className="absolute left-1/2 top-0 w-0.5 h-full bg-gray-400 z-10" />
              <div className="absolute top-0 h-full bg-purple-500 rounded-full transition-all duration-700"
                style={{
                  left: '50%',
                  width: `${Math.abs(asymmetry.value) * 50}%`,
                  transform: asymmetry.value >= 0 ? 'none' : 'translateX(-100%)',
                }} />
            </div>
          </div>

          <p className="text-xs text-purple-800 bg-purple-50 border border-purple-200 rounded px-3 py-2">
            <strong>Clinical note:</strong> Asymmetry Index (AI) = (L – R) / (L + R).
            Values above 25% may indicate unilateral onset, a hallmark of early Parkinson's Disease.
          </p>
        </motion.div>
      )}

      {/* ── Clinical Insights ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }} className="glass-card p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Clinical Insights</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 bg-blue-50 rounded-xl">
            <h3 className="font-bold text-[#004F7E] mb-3">Resting Tremor Characteristics</h3>
            <p className="text-sm text-gray-700 mb-3">
              Present at rest, decreases with movement. Classic Parkinson's Disease indicator showing
              pill-rolling motion typically in hands and fingers.
            </p>
            <div className="space-y-2 mt-4">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Frequency Range:</span>
                <span className="font-mono font-semibold">3–7 Hz</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">ET Range:</span>
                <span className="font-mono font-semibold">7–12 Hz</span>
              </div>
            </div>
          </div>
          <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
            <h3 className="font-bold text-purple-900 mb-3">Diagnostic Significance</h3>
            <p className="text-sm text-gray-700 mb-3">
              Resting tremor frequency analysis provides objective measurement for Parkinson's
              Disease diagnosis and treatment monitoring.
            </p>
            <div className="space-y-2 mt-4">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Sensitivity:</span>
                <span className="font-mono font-semibold text-green-600">89–94%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Specificity:</span>
                <span className="font-mono font-semibold text-green-600">91–96%</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Analytics;