// src/pages/Dashboard.tsx

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Stethoscope,
  FileText,
  TrendingUp,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { Page } from '../App';
import { getDiagnosticSessions } from '../utils/api';
import type { DiagnosticSession } from '../types/session';

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

const Dashboard = ({ onNavigate }: DashboardProps) => {
  const [allSessions, setAllSessions] = useState<DiagnosticSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
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
  }, []);

  const recentActivity = useMemo(() => allSessions.slice(0, 4), [allSessions]);

  const avgFrequency = useMemo(() => {
    if (!allSessions.length) return 0;
    return allSessions.reduce((sum, s) => sum + s.frequency, 0) / allSessions.length;
  }, [allSessions]);

  const avgConfidence = useMemo(() => {
    if (!allSessions.length) return 0;
    return Math.round(
      allSessions.reduce((sum, s) => sum + s.confidence, 0) / allSessions.length
    );
  }, [allSessions]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="min-h-screen p-8"
    >
      <motion.div variants={itemVariants} className="mb-8">
        <h1 className="text-4xl font-bold text-[#004F7E] mb-2">Dashboard</h1>
        <p className="text-gray-600 text-lg">Welcome to the OBT Quantifier clinical hub</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* New Diagnostic Session */}
        <motion.button
          variants={itemVariants}
          onClick={() => onNavigate('diagnostic')}
          className="glass-card-hover p-8 text-left md:col-span-2 lg:col-span-1 lg:row-span-2 group"
        >
          <div className="h-full flex flex-col">
            <div className="p-4 bg-gradient-to-br from-[#004F7E] to-[#005A92] rounded-2xl w-20 h-20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Stethoscope className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">New Diagnostic Session</h3>
            <p className="text-gray-600 mb-6 flex-grow">
              Start a new tremor analysis session. Upload video, process kinematic data, and receive diagnostic insights.
            </p>
            <div className="flex items-center gap-2 text-[#004F7E] font-semibold">
              <span>Launch Pipeline</span>
              <Activity className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
            </div>
          </div>
        </motion.button>

        {/* Lab Results */}
        <motion.button
          variants={itemVariants}
          onClick={() => onNavigate('history')}
          className="glass-card-hover p-6 text-left group"
        >
          <div className="p-3 bg-blue-100 rounded-xl w-14 h-14 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <FileText className="w-7 h-7 text-[#004F7E]" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Lab Results</h3>
          <p className="text-gray-600 text-sm mb-3">View session history and diagnostic reports</p>
          <p className="text-3xl font-bold text-[#004F7E] font-mono">
            {loading ? '—' : allSessions.length}
          </p>
          <p className="text-sm text-gray-500">Total Reports</p>
        </motion.button>

        {/* Analytics */}
        <motion.button
          variants={itemVariants}
          onClick={() => onNavigate('analytics')}
          className="glass-card-hover p-6 text-left group"
        >
          <div className="p-3 bg-green-100 rounded-xl w-14 h-14 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-7 h-7 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Trend Analytics</h3>
          <p className="text-gray-600 text-sm mb-3">Frequency spectrograms and patterns</p>
          <p className="text-3xl font-bold text-green-600 font-mono">Live</p>
          <p className="text-sm text-gray-500">Interactive Charts</p>
        </motion.button>

        {/* Quick Stats */}
        <motion.div variants={itemVariants} className="glass-card p-6 md:col-span-2">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Quick Statistics</h3>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-8 h-8 border-4 border-[#004F7E] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-[#004F7E] font-mono mb-1">
                  {allSessions.length}
                </div>
                <div className="text-sm text-gray-600">Total Cases</div>
                <div className="text-xs text-gray-500 font-mono">All Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 font-mono mb-1">
                  {allSessions.length > 0 ? `${avgFrequency.toFixed(1)} Hz` : '—'}
                </div>
                <div className="text-sm text-gray-600">Avg Frequency</div>
                <div className="text-xs text-gray-500 font-mono">Peak: 4–6 Hz</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 font-mono mb-1">
                  {allSessions.length > 0 ? `${avgConfidence}%` : '—'}
                </div>
                <div className="text-sm text-gray-600">Avg Confidence</div>
                <div className="text-xs text-gray-500">Analysis Quality</div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div variants={itemVariants} className="glass-card p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Recent Activity</h2>
          <button
            onClick={() => onNavigate('history')}
            className="text-[#004F7E] font-semibold hover:underline"
          >
            View All
          </button>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-[#004F7E] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold">No sessions yet</p>
              <p className="text-sm">Complete a diagnostic to see activity here</p>
            </div>
          ) : (
            recentActivity.map((item, index) => {
              const timeAgo = new Date(item.timestamp).toLocaleString();
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${
                      item.status === 'normal' ? 'bg-green-100' : 'bg-yellow-100'
                    }`}>
                      {item.status === 'normal' ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-6 h-6 text-yellow-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{item.patientId}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        <span>{timeAgo}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xl font-bold text-gray-900">
                      {item.frequency.toFixed(1)} Hz
                    </p>
                    <p className="text-sm font-semibold text-[#004F7E]">
                      {item.leftHand?.label || item.rightHand?.label || 'Tremor Pattern'}
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;