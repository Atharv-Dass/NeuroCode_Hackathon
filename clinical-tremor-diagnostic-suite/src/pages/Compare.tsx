import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, BarChart, Bar,
} from 'recharts';
import {
  ArrowLeftRight, TrendingUp, TrendingDown, Minus,
  ChevronDown, Activity, BarChart3, Brain, AlertCircle,
} from 'lucide-react';
import { getDiagnosticSessions } from '../utils/api';
import type { DiagnosticSession } from '../types/session';

interface CompareProps {
  onNavigate?: (page: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pctChange(before: number, after: number): number {
  if (before === 0) return 0;
  return ((after - before) / before) * 100;
}

function ChangeTag({ before, after, unit = '', invertGood = false }: {
  before: number; after: number; unit?: string; invertGood?: boolean;
}) {
  const pct = pctChange(before, after);
  const improved = invertGood ? pct > 0 : pct < 0;
  const neutral  = Math.abs(pct) < 1;
  const color = neutral
    ? 'bg-gray-100 text-gray-600'
    : improved
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-700';
  const Icon = neutral ? Minus : improved ? TrendingDown : TrendingUp;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
      <Icon className="w-3 h-3" />
      {neutral ? 'No change' : `${Math.abs(pct).toFixed(1)}%${unit}`}
    </span>
  );
}

function sessionLabel(s: DiagnosticSession) {
  if (s.label) return s.label;
  const l = s.leftHand, r = s.rightHand;
  if (!l && !r) return 'No tremor detected';
  if (!l) return r!.label;
  if (!r) return l.label;
  return l.amplitude >= r.amplitude ? l.label : r.label;
}

function mergeSpectrogram(
  before: { frequency: number; amplitude: number }[],
  after:  { frequency: number; amplitude: number }[],
) {
  const map = new Map<number, { frequency: number; before?: number; after?: number }>();
  before.forEach(p => {
    const k = Math.round(p.frequency * 10) / 10;
    map.set(k, { frequency: k, before: p.amplitude });
  });
  after.forEach(p => {
    const k = Math.round(p.frequency * 10) / 10;
    const existing = map.get(k) ?? { frequency: k };
    map.set(k, { ...existing, after: p.amplitude });
  });
  return Array.from(map.values()).sort((a, b) => a.frequency - b.frequency);
}

// ── Session Selector ──────────────────────────────────────────────────────────

function SessionSelect({
  sessions, value, onChange, label, color,
}: {
  sessions: DiagnosticSession[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  color: string;
}) {
  return (
    <div className="flex-1">
      <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${color}`}>
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none px-4 py-3 pr-10 border-2 border-gray-200 rounded-xl
                     focus:border-[#004F7E] focus:outline-none bg-white font-medium text-gray-800
                     transition-colors cursor-pointer"
        >
          <option value="">— Select session —</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>
              {s.patientId} · {new Date(s.date).toLocaleDateString()} · {s.frequency.toFixed(1)} Hz
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon, title, before, after, unit, invertGood, iconBg, iconColor,
}: {
  icon: React.ElementType; title: string;
  before: number; after: number;
  unit?: string; invertGood?: boolean;
  iconBg: string; iconColor: string;
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <p className="text-sm font-semibold text-gray-600">{title}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
          <p className="text-xs text-orange-600 font-semibold mb-1">Before</p>
          <p className="text-xl font-bold font-mono text-orange-700">
            {before.toFixed(2)}{unit}
          </p>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-blue-600 font-semibold mb-1">After</p>
          <p className="text-xl font-bold font-mono text-blue-700">
            {after.toFixed(2)}{unit}
          </p>
        </div>
      </div>
      <ChangeTag before={before} after={after} unit={unit} invertGood={invertGood} />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const Compare = ({ onNavigate }: CompareProps) => {
  const [sessions, setSessions]     = useState<DiagnosticSession[]>([]);
  const [beforeId, setBeforeId]     = useState('');
  const [afterId, setAfterId]       = useState('');
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    getDiagnosticSessions()
      .then(s => setSessions(s))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const beforeSession = sessions.find(s => s.id === beforeId) ?? null;
  const afterSession  = sessions.find(s => s.id === afterId)  ?? null;
  const canCompare    = !!beforeSession && !!afterSession && beforeId !== afterId;

  const mergedSpectrogram = canCompare
    ? mergeSpectrogram(
        beforeSession!.spectrogramData ?? [],
        afterSession!.spectrogramData  ?? [],
      )
    : [];

  const handData = canCompare ? [
    {
      name: 'Left Freq (Hz)',
      Before: beforeSession!.leftHand?.frequency ?? 0,
      After:  afterSession!.leftHand?.frequency  ?? 0,
    },
    {
      name: 'Right Freq (Hz)',
      Before: beforeSession!.rightHand?.frequency ?? 0,
      After:  afterSession!.rightHand?.frequency  ?? 0,
    },
    {
      name: 'Left Amp',
      Before: beforeSession!.leftHand?.amplitude ?? 0,
      After:  afterSession!.leftHand?.amplitude  ?? 0,
    },
    {
      name: 'Right Amp',
      Before: beforeSession!.rightHand?.amplitude ?? 0,
      After:  afterSession!.rightHand?.amplitude  ?? 0,
    },
  ] : [];

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#004F7E] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Loading sessions...</p>
        </div>
      </div>
    );
  }

  // ── Not enough sessions ────────────────────────────────────────────────────
  if (sessions.length < 2) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-16 text-center max-w-xl">
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ArrowLeftRight className="w-12 h-12 text-[#004F7E]" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Need 2 Sessions to Compare</h2>
          <p className="text-lg text-gray-600 mb-8">
            You currently have <span className="font-bold text-[#004F7E]">{sessions.length}</span> saved session{sessions.length === 1 ? '' : 's'}.
            Complete at least 2 diagnostic sessions to use the comparison tool.
          </p>
          <button onClick={() => onNavigate?.('diagnostic')} className="btn-primary text-lg px-8 py-4">
            Run New Session
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[#004F7E] mb-2">Before & After Comparison</h1>
        <p className="text-gray-600 text-lg">Compare two sessions to measure treatment response</p>
      </div>

      {/* Session Selectors */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <SessionSelect
            sessions={sessions}
            value={beforeId}
            onChange={setBeforeId}
            label="Before (Pre-medication / Baseline)"
            color="text-orange-600"
          />
          <div className="flex items-center justify-center pb-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>
          <SessionSelect
            sessions={sessions}
            value={afterId}
            onChange={setAfterId}
            label="After (Post-medication / Follow-up)"
            color="text-blue-600"
          />
        </div>
        {beforeId === afterId && beforeId !== '' && (
          <p className="mt-3 text-sm text-red-500 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Please select two different sessions.
          </p>
        )}
      </motion.div>

      {/* Prompt when nothing selected */}
      {!canCompare && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass-card p-16 text-center">
          <ArrowLeftRight className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-500">
            Select a Before and After session above to compare
          </p>
        </motion.div>
      )}

      {/* Comparison content */}
      {canCompare && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }} className="space-y-8">

          {/* Session summary banners */}
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { session: beforeSession!, label: 'Before', bg: 'bg-orange-50', border: 'border-orange-200', color: 'text-orange-700', dot: 'bg-orange-500' },
              { session: afterSession!,  label: 'After',  bg: 'bg-blue-50',   border: 'border-blue-200',   color: 'text-blue-700',   dot: 'bg-blue-500'   },
            ].map(({ session, label, bg, border, color, dot }) => (
              <div key={label} className={`p-5 rounded-xl border-2 ${bg} ${border}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-3 h-3 rounded-full ${dot}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${color}`}>{label}</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{session.patientId}</p>
                <p className="text-sm text-gray-600">{new Date(session.date).toLocaleDateString()} · {session.method}</p>
                <p className={`text-sm font-semibold mt-2 ${color}`}>{sessionLabel(session)}</p>
              </div>
            ))}
          </div>

          {/* Metric Cards */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Key Metrics</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={TrendingUp} title="Peak Frequency"
                before={beforeSession!.frequency} after={afterSession!.frequency}
                unit=" Hz" invertGood={false}
                iconBg="bg-blue-100" iconColor="text-[#004F7E]"
              />
              <MetricCard
                icon={BarChart3} title="Peak Amplitude"
                before={beforeSession!.amplitude} after={afterSession!.amplitude}
                invertGood={false}
                iconBg="bg-purple-100" iconColor="text-purple-600"
              />
              <MetricCard
                icon={Activity} title="Confidence"
                before={beforeSession!.confidence} after={afterSession!.confidence}
                unit="%" invertGood={true}
                iconBg="bg-green-100" iconColor="text-green-600"
              />
              <MetricCard
                icon={Brain} title="Asymmetry"
                before={beforeSession!.asymmetry?.percent ?? 0}
                after={afterSession!.asymmetry?.percent ?? 0}
                unit="%" invertGood={false}
                iconBg="bg-orange-100" iconColor="text-orange-600"
              />
            </div>
          </div>

          {/* Overlapping Spectrogram */}
          <div className="glass-card p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Frequency Spectrogram Overlay</h2>
              <p className="text-gray-600 text-sm">Both sessions plotted on the same axes for direct comparison</p>
            </div>

            {mergedSpectrogram.length > 0 ? (
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={mergedSpectrogram}>
                    <defs>
                      <linearGradient id="gradBefore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}   />
                      </linearGradient>
                      <linearGradient id="gradAfter" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="frequency"
                      label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -5 }}
                      stroke="#6b7280" style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      label={{ value: 'Amplitude', angle: -90, position: 'insideLeft' }}
                      stroke="#6b7280" style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(255,255,255,0.97)', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      labelFormatter={l => `${l} Hz`}
                      formatter={(v, n) => [Number(v).toFixed(4), n === 'before' ? 'Before' : 'After']}
                    />
                    <Legend formatter={v => v === 'before' ? 'Before (pre-medication)' : 'After (post-medication)'} />
                    <Area type="monotone" dataKey="before" stroke="#f97316" strokeWidth={2.5}
                      fill="url(#gradBefore)" connectNulls dot={false} animationDuration={600} />
                    <Area type="monotone" dataKey="after"  stroke="#3b82f6" strokeWidth={2.5}
                      fill="url(#gradAfter)"  connectNulls dot={false} animationDuration={600} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <p className="text-gray-400 font-semibold">
                  One or both sessions have no spectrogram data recorded
                </p>
              </div>
            )}

            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-orange-500 rounded" />
                <span className="text-gray-600 font-medium">Before — {beforeSession!.frequency.toFixed(1)} Hz peak</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-blue-500 rounded" />
                <span className="text-gray-600 font-medium">After — {afterSession!.frequency.toFixed(1)} Hz peak</span>
              </div>
            </div>
          </div>

          {/* Per-hand comparison bar chart */}
          {(beforeSession!.leftHand || beforeSession!.rightHand) && (
            <div className="glass-card p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Per-Hand Comparison</h2>
              <p className="text-gray-600 text-sm mb-6">Frequency and amplitude per hand before and after</p>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={handData} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(255,255,255,0.97)', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(v, n) => [Number(v).toFixed(3), n === 'Before' ? 'Before' : 'After']}
                    />
                    <Legend />
                    <Bar dataKey="Before" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="After"  fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Asymmetry comparison */}
          {(beforeSession!.asymmetry || afterSession!.asymmetry) && (
            <div className="glass-card p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Asymmetry Index Comparison</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { session: beforeSession!, label: 'Before', bg: 'bg-orange-50', border: 'border-orange-200', barColor: 'bg-orange-500', textColor: 'text-orange-700' },
                  { session: afterSession!,  label: 'After',  bg: 'bg-blue-50',   border: 'border-blue-200',   barColor: 'bg-blue-500',   textColor: 'text-blue-700'   },
                ].map(({ session, label, bg, border, barColor, textColor }) => (
                  <div key={label} className={`p-5 rounded-xl border ${bg} ${border}`}>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${textColor}`}>{label}</p>
                    {session.asymmetry ? (
                      <>
                        <div className="flex justify-between items-baseline mb-2">
                          <span className="text-3xl font-bold font-mono text-gray-900">
                            {session.asymmetry.percent.toFixed(1)}%
                          </span>
                          <span className="text-sm font-semibold text-gray-500">
                            {session.asymmetry.dominant} dominant
                          </span>
                        </div>
                        <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
                          <div className="absolute left-1/2 top-0 w-0.5 h-full bg-gray-400 z-10" />
                          <div className={`absolute top-0 h-full ${barColor} rounded-full transition-all`}
                            style={{
                              left: '50%',
                              width: `${Math.abs(session.asymmetry.value) * 50}%`,
                              transform: session.asymmetry.value >= 0 ? 'none' : 'translateX(-100%)',
                            }} />
                        </div>
                        <p className="text-xs text-gray-500">Index: {session.asymmetry.value.toFixed(3)}</p>
                      </>
                    ) : (
                      <p className="text-gray-400 text-sm">No asymmetry data</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clinical summary */}
          <div className="glass-card p-8 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Treatment Response Summary</h2>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500 font-semibold mb-1">Frequency Change</p>
                <p className="text-2xl font-bold font-mono text-gray-900">
                  {afterSession!.frequency.toFixed(1)} Hz
                </p>
                <ChangeTag before={beforeSession!.frequency} after={afterSession!.frequency} unit=" Hz" />
              </div>
              <div>
                <p className="text-gray-500 font-semibold mb-1">Amplitude Change</p>
                <p className="text-2xl font-bold font-mono text-gray-900">
                  {afterSession!.amplitude.toFixed(3)}
                </p>
                <ChangeTag before={beforeSession!.amplitude} after={afterSession!.amplitude} />
              </div>
              <div>
                <p className="text-gray-500 font-semibold mb-1">Asymmetry Change</p>
                <p className="text-2xl font-bold font-mono text-gray-900">
                  {afterSession!.asymmetry?.percent.toFixed(1) ?? '–'}%
                </p>
                {beforeSession!.asymmetry && afterSession!.asymmetry && (
                  <ChangeTag
                    before={beforeSession!.asymmetry.percent}
                    after={afterSession!.asymmetry.percent}
                  />
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-6 border-t border-blue-100 pt-4">
              <strong>Note:</strong> Green tags indicate improvement (reduced frequency/amplitude/asymmetry).
              Red tags indicate worsening. Always interpret results in clinical context.
            </p>
          </div>

        </motion.div>
      )}
    </div>
  );
};

export default Compare;