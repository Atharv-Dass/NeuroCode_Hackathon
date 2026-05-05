import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Diagnostic from './pages/Diagnostic';
import History from './pages/History';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Compare from './pages/Compare';

export type Page = 'landing' | 'dashboard' | 'diagnostic' | 'history' | 'analytics' | 'settings' | 'compare';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);

  const handleViewSession = (sessionId: string) => {
    setViewingSessionId(sessionId);
    setCurrentPage('analytics');
  };

  const handleNavigate = (page: Page) => {
    if (page !== 'analytics') {
      setViewingSessionId(null);
    }
    setCurrentPage(page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'landing':
        return <Landing onNavigate={handleNavigate} />;
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'diagnostic':
        return <Diagnostic onNavigate={handleNavigate} />;
      case 'history':
        return <History onNavigate={handleNavigate} onViewSession={handleViewSession} />;
      case 'analytics':
        return <Analytics onNavigate={handleNavigate} sessionId={viewingSessionId} />;
      case 'compare':
        return <Compare onNavigate={handleNavigate} />;
      case 'settings':
        return <Settings onNavigate={handleNavigate} />;
      default:
        return <Landing onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen flex">
      {currentPage !== 'landing' && (
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      )}
      <div className={`flex-1 ${currentPage !== 'landing' ? 'ml-64' : ''}`}>
        <AnimatePresence mode="wait">
          {renderPage()}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;