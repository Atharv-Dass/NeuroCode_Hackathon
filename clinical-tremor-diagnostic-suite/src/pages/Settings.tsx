import { motion } from 'framer-motion';
import { User, Bell, Info } from 'lucide-react';
import { Page } from '../App';

interface SettingsProps {
  onNavigate?: (page: Page) => void;
}

const Settings = ({ onNavigate }: SettingsProps) => {
  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[#004F7E] mb-2">Settings</h1>
        <p className="text-gray-600 text-lg">Configure your OBT Quantifier preferences</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* User Profile */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-[#004F7E] rounded-xl">
              <User className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">User Profile</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
              <input
                type="text"
                defaultValue="Dr. Sarah Johnson"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#004F7E] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                defaultValue="sarah.johnson@hospital.com"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#004F7E] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Department</label>
              <input
                type="text"
                defaultValue="Neurology"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#004F7E] focus:outline-none"
              />
            </div>
          </div>
        </motion.div>

        {/* Notifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-green-600 rounded-xl">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Alert Notifications', desc: 'Get notified for high-priority results' },
              { label: 'Email Reports', desc: 'Receive diagnostic summaries via email' },
              { label: 'Session Complete', desc: 'Notification when analysis is finished' },
              { label: 'Weekly Summary', desc: 'Weekly statistics and insights' },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-semibold text-gray-900">{item.label}</p>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked={index < 2} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#004F7E]"></div>
                </label>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* System Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-8 mt-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gray-700 rounded-xl">
            <Info className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">System Information</h2>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">Version</p>
            <p className="font-mono font-bold text-lg text-gray-900">v1.0.0</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Last Updated</p>
            <p className="font-mono font-bold text-lg text-gray-900">{new Date().toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">License</p>
            <p className="font-mono font-bold text-lg text-gray-900">Medical</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Support</p>
            <p className="font-bold text-lg text-[#004F7E]">24/7 Active</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Settings;
