import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar, NavTab } from './Sidebar';
import { ToastContainer } from '../ui/Toast';
import { LoginModal } from '../auth/LoginModal';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-forest-900 text-gray-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Navigation Header */}
      <Header
        onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-gradient-to-b from-forest-900 via-forest-900 to-forest-950">
          {children}
        </main>
      </div>

      {/* Global Modals & Notifications */}
      <LoginModal />
      <ToastContainer />
    </div>
  );
};
