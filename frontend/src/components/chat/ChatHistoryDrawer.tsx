import React from 'react';
import { useChat } from '../../context/ChatContext';
import { Plus, MessageSquare, Trash2, X, History, Sparkles } from 'lucide-react';

interface ChatHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatHistoryDrawer: React.FC<ChatHistoryDrawerProps> = ({ isOpen, onClose }) => {
  const { sessions, activeSessionId, createNewSession, switchSession, deleteSession, clearChat } = useChat();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card border-l border-border h-full shadow-2xl flex flex-col text-card-foreground animate-in slide-in-from-right duration-300">
        <div className="h-1.5 bg-accent shrink-0" />

        {/* Drawer Header */}
        <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-accent/10 rounded-lg text-accent">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold font-serif">Device Research Chats</h3>
              <p className="text-xs text-muted-foreground">{sessions.length} saved session{sessions.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            aria-label="Close history drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Action Button */}
        <div className="p-4 border-b border-border bg-muted/30 shrink-0">
          <button
            type="button"
            onClick={() => {
              createNewSession();
              onClose();
            }}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-xs font-semibold text-accent-foreground shadow transition-all hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" /> Start New Research Chat
          </button>
        </div>

        {/* Saved Conversations List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const messageCount = session.messages.filter((m) => m.id !== 'welcome-msg').length;
            const lastUpdated = new Date(session.updatedAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={session.id}
                className={`group relative flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-accent/10 border-accent font-semibold text-foreground shadow-sm'
                    : 'bg-background hover:bg-muted border-border text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  switchSession(session.id);
                  onClose();
                }}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1 pr-2">
                  <div className={`p-1.5 rounded-md mt-0.5 shrink-0 ${isActive ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold truncate leading-tight">
                      {session.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                      <span>{messageCount} query{messageCount === 1 ? '' : 'ies'}</span>
                      <span>•</span>
                      <span>{lastUpdated}</span>
                    </div>
                  </div>
                </div>

                {/* Delete session button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 opacity-60 group-hover:opacity-100 transition-opacity"
                  title="Delete chat session"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-border bg-muted/40 flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={clearChat}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors font-medium"
          >
            Clear Active Messages
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs rounded-lg border border-border transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
