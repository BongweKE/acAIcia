import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useSettings } from '../../context/SettingsContext';
import { MessageItem } from './MessageItem';
import { PromptPills } from './PromptPills';
import { StatusIndicator } from './StatusIndicator';
import { FeedbackModal } from '../feedback/FeedbackModal';
import { SettingsModal } from '../settings/SettingsModal';
import { ChatHistoryDrawer } from './ChatHistoryDrawer';
import { Send, Cpu, Plus, History, MessageSquare, AlertTriangle } from 'lucide-react';

export const ChatArea: React.FC = () => {
  const { messages, submitUserQuery, isProcessing, currentStage, sessions, activeSessionId, createNewSession } = useChat();
  const { activeModelName } = useSettings();

  const [inputQuery, setInputQuery] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing, currentStage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isProcessing) return;

    const queryToSubmit = inputQuery;
    setInputQuery('');
    submitUserQuery(queryToSubmit);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 max-w-5xl mx-auto w-full p-4 sm:p-6 bg-card text-card-foreground">
      {/* Header Session Bar */}
      <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-accent/10 rounded-lg text-accent shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <h2 className="text-xs font-semibold truncate text-foreground">
            {activeSession ? activeSession.title : 'Research Chat'}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={createNewSession}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
            title="Start a new research chat session"
          >
            <Plus className="w-3.5 h-3.5 text-accent" />
            <span className="hidden sm:inline">New Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
            title="View saved device chat history"
          >
            <History className="w-3.5 h-3.5 text-accent" />
            <span>History</span>
            {sessions.length > 0 && (
              <span className="ml-0.5 rounded-full bg-accent/10 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-accent">
                {sessions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Scrollable Message History */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-1 pb-4 min-h-[380px]">
        {messages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}

        {/* Suggested Prompt Pills if only welcome message present */}
        {messages.length <= 1 && !isProcessing && (
          <div className="pt-4 border-t border-border">
            <PromptPills onSelectPill={(pill) => submitUserQuery(pill)} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Dock */}
      <div className="shrink-0 pt-3 space-y-2 border-t border-border mt-4">
        {/* Active Model & Fact Check Warning Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground px-1">
          <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md border border-border">
            <Cpu className="w-3.5 h-3.5 text-accent" />
            <span>Active Model: <strong className="text-foreground">{activeModelName}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
            <AlertTriangle className="w-3.5 h-3.5 text-chart-4 shrink-0" />
            <span>AI-generated responses should be fact-checked before decision making</span>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            rows={3}
            disabled={isProcessing}
            placeholder="Ask acAIcia about agroforestry, crop science, soil nutrients, or sustainable farming..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-4 pr-14 py-3 bg-background border border-input rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none shadow-sm disabled:opacity-50 font-sans"
          />

          <div className="absolute right-2.5 bottom-3.5">
            <button
              type="submit"
              disabled={!inputQuery.trim() || isProcessing}
              className="p-2.5 bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send query"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>

        <p className="text-[11px] text-center text-muted-foreground/75 pt-0.5">
          acAIcia synthesises peer-reviewed literature. Verify critical research details and DOIs before field application.
        </p>
      </div>

      {/* Global Modals & Drawers */}
      <ChatHistoryDrawer isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      <FeedbackModal />
      <SettingsModal />
    </div>
  );
};
