import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { Sprout, Settings, LogIn, LogOut, ShieldCheck, User, Menu } from 'lucide-react';

import { NavTab } from './Sidebar';

interface HeaderProps {
  onToggleSidebar?: () => void;
  activeTab?: NavTab;
  setActiveTab?: (tab: NavTab) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, activeTab, setActiveTab }) => {
  const { role, roleDisplayName, guestQueryCount, guestQueryLimit, openLoginModal, logout, user } = useAuth();
  const { openSettings } = useSettings();

  return (
    <header className="sticky top-0 z-30 h-16 bg-forest-900/90 backdrop-blur-md border-b border-forest-700/60 px-4 flex items-center justify-between shadow-md">
      {/* Left section: Mobile menu + Logo */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 text-gray-300 hover:text-white rounded-lg bg-forest-800/60 border border-forest-700 md:hidden hover:bg-forest-700 transition-colors"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab && setActiveTab('chat')}>
          <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/30 shadow-glow">
            <Sprout className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white tracking-tight font-sans">
                ac<span className="text-emerald-400">AI</span>cia
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-gray-400 hidden sm:block">Agriscience AI Assistant</p>
          </div>
        </div>
      </div>

      {/* Right section: Counter, Badges, Admin Link, Settings, Auth Button */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Guest Query Counter Badge */}
        {role === 'guest' && (
          <div
            className={`px-3 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              guestQueryCount > 5
                ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
                : 'bg-rose-950/40 border-rose-700/50 text-rose-300 animate-pulse'
            }`}
            title="Guest query limit tracking (20 max)"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>
              Queries: <span className="font-mono">{guestQueryCount}/{guestQueryLimit}</span> left
            </span>
          </div>
        )}

        {/* User Role Badge */}
        <div
          className={`px-2.5 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5 ${
            role === 'admin'
              ? 'bg-purple-950/40 border-purple-700/50 text-purple-300'
              : role === 'researcher'
              ? 'bg-blue-950/40 border-blue-700/50 text-blue-300'
              : 'bg-forest-800 border-forest-700 text-gray-300'
          }`}
        >
          {role === 'admin' ? (
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
          ) : (
            <User className="w-3.5 h-3.5 text-blue-400" />
          )}
          <span>{roleDisplayName}</span>
        </div>

        {/* Admin Direct Button (Visible if admin) */}
        {role === 'admin' && setActiveTab && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
              activeTab === 'admin'
                ? 'bg-purple-600 text-white border-purple-400'
                : 'bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 border-purple-700/40'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Admin Dashboard</span>
          </button>
        )}

        {/* Settings Modal Button */}
        <button
          onClick={openSettings}
          className="p-2 text-gray-300 hover:text-emerald-300 bg-forest-800/80 hover:bg-forest-700 border border-forest-700 rounded-lg transition-colors"
          title="Settings & Provider Config"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Login / Logout Button */}
        {role === 'guest' ? (
          <button
            onClick={openLoginModal}
            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-forest-950 font-semibold text-xs rounded-lg transition-all shadow-glow flex items-center gap-1.5"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Login</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-300 hidden md:inline truncate max-w-[120px]">
              {user?.email}
            </span>
            <button
              onClick={logout}
              className="p-2 text-gray-300 hover:text-rose-400 bg-forest-800/80 hover:bg-forest-700 border border-forest-700 rounded-lg transition-colors flex items-center gap-1"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
