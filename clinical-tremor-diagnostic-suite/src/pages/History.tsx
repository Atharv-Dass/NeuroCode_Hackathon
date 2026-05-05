import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Filter, Calendar, Activity,
  AlertCircle, CheckCircle2, FileText, Stethoscope, Trash2
} from 'lucide-react';
import { Page } from '../App';
import { getDiagnosticSessions } from '../utils/api';
import type { DiagnosticSession } from '../types/session';

interface HistoryProps {
  onNavigate: (page: Page) => void;
  onViewSession: (sessionId: string) => void;
}

type FilterType = 'all' | 'alert' | 'resting';

// Pick the best label from a session — same logic as Diagnostic.tsx
function sessionLabel(session: DiagnosticSession): string {
  if (session.label) return session.label;
  const l = session.leftHand;
  const r = session.rightHand;
  if (!l && !r) return 'No tremor detected';
  if (!l) return r!.label;
  if (!r) return l.label;
  return l.amplitude >= r.amplitude ? l.label : r.label;
}

const History = ({ onNavigate, onViewSession }: HistoryProps) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [allSessions, setAllSessions] = useState<DiagnosticSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const sessions = await getDiagnosticSessions();
        setAllSessions(sessions);
      } catch (err) {
        console.error('Failed to load sessions:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey]);

  const handleDelete = async (id: string, patientId: string) => {
    if (!confirm(`Are you sure you want to delete the report for ${patientId}?`)) return;
    try {
      const response = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Failed to delete session:', err);
      alert('Failed to delete session. Please try again.');
    }
  };

  const filteredSessions = allSessions.filter(session => {
    if (activeFilter === 'alert' && session.status !== 'alert') return false;
    if (searchTerm && !session.patientId.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all',     label: 'All Sessions' },
    { id: 'alert',   label: 'Alert' },
    { id: 'resting', label: 'Resting' },
  ];

  return (
    <div className="min-h-screen p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[#004F7E] mb-2">Lab Results</h1>
        <p className="text-gray-600 text-lg">Session history and diagnostic reports</p>
      </div>

      <div className="glass-card p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#004F7E] focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-4 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                  activeFilter === filter.id
                    ? 'bg-[#004F7E] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Filter className="w-4 h-4" />
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-16 text-center">
          <div className="w-12 h-12 border-4 border-[#004F7E] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Loading sessions...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-16 text-center"
        >
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">No Sessions Yet</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            {searchTerm || activeFilter !== 'all'
              ? 'No sessions match your current filters. Try adjusting your search or filter criteria.'
              : 'Start your first diagnostic session to see results here.'}
          </p>
          <button
            onClick={() => onNavigate('diagnostic')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Stethoscope className="w-5 h-5" />
            Start New Session
          </button>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card-hover p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`p-3 rounded-xl ${
                    session.status === 'alert' ? 'bg-yellow-100' : 'bg-green-100'
                  }`}>
                    {session.status === 'alert' ? (
                      <AlertCircle className="w-6 h-6 text-yellow-600" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{session.patientId}</h3>
                      {/* ── FIX: use sessionLabel() instead of leftHand?.label || rightHand?.label ── */}
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-[#004F7E]">
                        {sessionLabel(session)}
                      </span>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(session.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        <span className="capitalize">{session.method}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Frequency</p>
                        <p className="font-mono font-bold text-lg text-gray-900">{session.frequency.toFixed(1)} Hz</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Amplitude</p>
                        <p className="font-mono font-bold text-lg text-gray-900">{session.amplitude.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Confidence</p>
                        <p className="font-mono font-bold text-lg text-green-600">{session.confidence}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Status</p>
                        <p className={`font-semibold text-sm ${
                          session.status === 'alert' ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {session.status === 'alert' ? 'Review' : 'Normal'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => onViewSession(session.id)}
                    className="btn-secondary px-4 py-2 text-sm"
                  >
                    View Report
                  </button>
                  <button
                    onClick={() => handleDelete(session.id, session.patientId)}
                    className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg font-semibold border-2 border-red-200 hover:bg-red-600 hover:text-white transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {filteredSessions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 mt-8"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4">Summary Statistics</h3>
          <div className="grid grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-[#004F7E] font-mono">{filteredSessions.length}</p>
              <p className="text-sm text-gray-600 mt-1">Total Sessions</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600 font-mono">
                {(filteredSessions.reduce((sum, s) => sum + s.frequency, 0) / filteredSessions.length).toFixed(1)} Hz
              </p>
              <p className="text-sm text-gray-600 mt-1">Avg Frequency</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600 font-mono">
                {(filteredSessions.reduce((sum, s) => sum + s.confidence, 0) / filteredSessions.length).toFixed(0)}%
              </p>
              <p className="text-sm text-gray-600 mt-1">Avg Confidence</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-600 font-mono">
                {filteredSessions.filter(s => s.status === 'alert').length}
              </p>
              <p className="text-sm text-gray-600 mt-1">Alerts</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default History;