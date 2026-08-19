import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import {
  MessageSquare,
  Plus,
  Info,
  HelpCircle,
  BookOpen,
  Mail,
  ShieldCheck,
  Trash2,
  X,
  Leaf,
  MessageCircle,
} from 'lucide-react';

export type NavTab = 'chat' | 'about' | 'faqs' | 'blogs' | 'contact' | 'admin';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isOpen: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ReactNode;
  requiresAdmin?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, onCloseMobile }) => {
  const { role } = useAuth();
  const { sessions, activeSessionId, createNewSession, switchSession, deleteSession, clearChat, messages } = useChat();

  const navItems: NavItem[] = [
    { id: 'chat', label: 'RAG Research Chat', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'about', label: 'About acAIcia', icon: <Info className="w-4 h-4" /> },
    { id: 'faqs', label: 'Frequently Asked Questions', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'blogs', label: 'Research Blogs', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'contact', label: 'Contact & Support', icon: <Mail className="w-4 h-4" /> },
    { id: 'admin', label: 'Admin Dashboard', icon: <ShieldCheck className="w-4 h-4" />, requiresAdmin: true },
  ];

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const handleNewChat = () => {
    createNewSession();
    setActiveTab('chat');
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-xs"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed md:static top-16 bottom-0 left-0 z-40 w-64 bg-forest-900/95 border-r border-forest-700/60 flex flex-col justify-between transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Navigation Items */}
        <div className="p-4 space-y-6 overflow-y-auto flex-1">
          <div className="flex items-center justify-between md:hidden pb-2 border-b border-forest-800">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Navigation</span>
            <button onClick={onCloseMobile} className="p-1 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New Chat Button */}
          <div>
            <button
              onClick={handleNewChat}
              className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-forest-950 font-bold text-xs rounded-xl transition-all shadow-glow flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Research Chat</span>
            </button>
          </div>

          {/* Recent Sessions List */}
          {activeTab === 'chat' && sessions.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-forest-800/80">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-3 flex items-center justify-between">
                <span>Recent Chats</span>
                <span className="text-[10px] text-emerald-400 font-mono">{sessions.length}</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {sessions.map((s) => {
                  const isActive = s.id === activeSessionId;
                  return (
                    <div
                      key={s.id}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-200 font-medium border border-emerald-500/30'
                          : 'text-gray-400 hover:bg-forest-800/60 hover:text-gray-200 border border-transparent'
                      }`}
                      onClick={() => {
                        switchSession(s.id);
                        setActiveTab('chat');
                        if (onCloseMobile) onCloseMobile();
                      }}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MessageCircle className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-emerald-400' : 'text-gray-500'}`} />
                        <span className="truncate">{s.title}</span>
                      </div>
                      {sessions.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(s.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-rose-400 transition-opacity"
                          title="Delete session"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Workspace Views */}
          <div className="space-y-1 pt-2 border-t border-forest-800/80">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-3 mb-2">
              Workspace Views
            </div>
            {navItems.map((item) => {
              if (item.requiresAdmin && role !== 'admin') return null;

              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-glow'
                      : 'text-gray-300 hover:bg-forest-800 hover:text-white border border-transparent'
                  }`}
                >
                  <span className={isActive ? 'text-emerald-400' : 'text-gray-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Clear Current Chat */}
          {activeTab === 'chat' && messages.length > 1 && (
            <div className="pt-4 border-t border-forest-800 space-y-2">
              <button
                onClick={clearChat}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-950/20 hover:bg-rose-900/30 border border-rose-800/30 rounded-xl transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Current Chat</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer info in sidebar */}
        <div className="p-4 border-t border-forest-800/80 bg-forest-950/40 space-y-3">
          <div className="p-3 bg-forest-800/50 rounded-xl border border-forest-700/50 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <Leaf className="w-3.5 h-3.5" />
              <span>Agriscience RAG Engine</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-normal">
              Empowering sustainable agriculture through peer-reviewed intelligence synthesis.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
