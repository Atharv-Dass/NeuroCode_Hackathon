import { 
  Home, 
  Activity, 
  Stethoscope, 
  FileText, 
  TrendingUp, 
  Settings as SettingsIcon,
  LogOut 
} from 'lucide-react';
import { Page } from '../App';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const Sidebar = ({ currentPage, onNavigate }: SidebarProps) => {
  const menuItems = [
    { id: 'dashboard' as Page, label: 'Dashboard', icon: Home },
    { id: 'diagnostic' as Page, label: 'Diagnostic', icon: Stethoscope },
    { id: 'history' as Page, label: 'Lab Results', icon: FileText },
    { id: 'analytics' as Page, label: 'Analytics', icon: TrendingUp },
    { id: 'settings' as Page, label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="fixed left-0 top-0 h-screen w-64 glass-card border-r-2 border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#004F7E] rounded-lg">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-[#004F7E]">OBT Quantifier</h1>
            <p className="text-xs text-gray-500">Clinical Suite</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-[#004F7E] text-white shadow-lg'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-[#004F7E]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => onNavigate('landing')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-red-50 hover:text-[#E31D2B] transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Website Home</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
