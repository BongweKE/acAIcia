import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings, PROVIDER_OPTIONS } from '../../context/SettingsContext';
import { MessageItem } from './MessageItem';
import { PromptPills } from './PromptPills';
import { StatusIndicator } from './StatusIndicator';
import { FeedbackModal } from '../feedback/FeedbackModal';
import { SettingsModal } from '../settings/SettingsModal';
import { Send, Sprout, AlertCircle, Sparkles, Cpu, Lock } from 'lucide-react';

export const ChatArea: React.FC = () => {
  const { messages, submitUserQuery, isProcessing, currentStage } = useChat();
  const { role, guestQueryCount, openLoginModal } = useAuth();
  const { activeProvider, openSettings } = useSettings();

  const [inputQuery, setInputQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeProviderObj = PROVIDER_OPTIONS.find((p) => p.id === activeProvider) || PROVIDER_OPTIONS[0];

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
    <div className="flex-1 flex flex-col h-full min-w-0 max-w-5xl mx-auto w-full p-3 sm:p-6">
      {/* Scrollable Message History */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
        {messages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}

        {/* Dynamic Status Indicator for processing query */}
        <StatusIndicator isProcessing={isProcessing} currentStage={currentStage} />

        {/* Suggested Prompt Pills if only welcome message present */}
        {messages.length <= 1 && !isProcessing && (
          <div className="pt-4 border-t border-forest-800">
            <PromptPills onSelectPill={(pill) => submitUserQuery(pill)} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Dock */}
      <div className="shrink-0 pt-2 space-y-2">
        {/* Top input bar info: Provider pill & Guest count */}
        <div className="flex items-center justify-between text-xs text-gray-400 px-1">
          <div
            onClick={openSettings}
            className="flex items-center gap-1.5 cursor-pointer hover:text-emerald-300 transition-colors bg-forest-800/40 px-2.5 py-1 rounded-lg border border-forest-700/50"
            title="Click to configure model provider"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>Model: <strong className="text-gray-200">{activeProviderObj.name}</strong></span>
          </div>

          {role === 'guest' && (
            <div className="flex items-center gap-1.5">
              {guestQueryCount <= 0 ? (
                <span className="text-rose-400 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Limit reached (0/20)
                </span>
              ) : (
                <span className="text-emerald-300">
                  Guest Queries: <strong className="font-mono">{guestQueryCount}</strong> remaining
                </span>
              )}
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            rows={2}
            disabled={isProcessing || (role === 'guest' && guestQueryCount <= 0)}
            placeholder={
              role === 'guest' && guestQueryCount <= 0
                ? 'Guest query limit reached (20/20). Please login as a researcher...'
                : 'Ask acAIcia about agroforestry, crop science, soil nutrients, or sustainable farming...'
            }
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-4 pr-14 py-3 bg-forest-800/90 border border-forest-700 rounded-2xl text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none shadow-lg disabled:opacity-50 font-sans"
          />

          <div className="absolute right-2.5 bottom-3.5 flex items-center gap-1">
            {role === 'guest' && guestQueryCount <= 0 ? (
              <button
                type="button"
                onClick={openLoginModal}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-forest-950 font-bold text-xs rounded-xl shadow-glow transition-all"
              >
                Login
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputQuery.trim() || isProcessing}
                className="p-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-forest-950 rounded-xl transition-all shadow-glow hover:shadow-glow-lg disabled:opacity-40 disabled:hover:bg-emerald-500 disabled:cursor-not-allowed"
                aria-label="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Global Modals */}
      <FeedbackModal />
      <SettingsModal />
    </div>
  );
};
