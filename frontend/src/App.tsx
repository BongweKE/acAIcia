import React, { useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { ChatProvider } from './context/ChatContext';
import { Layout } from './components/layout/Layout';
import { NavTab } from './components/layout/Sidebar';
import { ChatPage } from './pages/ChatPage';
import { InfoPage } from './pages/InfoPage';
import { AdminPage } from './pages/AdminPage';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('chat');

  const renderActiveView = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatPage />;
      case 'about':
      case 'faqs':
      case 'blogs':
      case 'contact':
        return <InfoPage tab={activeTab} onNavigateToChat={() => setActiveTab('chat')} onSelectTab={setActiveTab} />;
      case 'admin':
        return <AdminPage />;
      default:
        return <ChatPage />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderActiveView()}
    </Layout>
  );
};

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SettingsProvider>
          <ChatProvider>
            <AppContent />
          </ChatProvider>
        </SettingsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
