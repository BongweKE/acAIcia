import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useSettings } from '../../context/SettingsContext';
import { MessageItem } from './MessageItem';
import { PromptPills } from './PromptPills';
import { StatusIndicator } from './StatusIndicator';
import { FeedbackModal } from '../feedback/FeedbackModal';
import { SettingsModal } from '../settings/SettingsModal';
import { Send, Cpu } from 'lucide-react';

export const ChatArea: React.FC = () => {
  const { messages, submitUserQuery, isProcessing, currentStage } = useChat();
  const { activeModelName } = useSettings();

  const [inputQuery, setInputQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      {/* Scrollable Message History */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-1 pb-4 min-h-[400px]">
        {messages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}

        {/* Dynamic Status Indicator for processing query */}
        <StatusIndicator isProcessing={isProcessing} currentStage={currentStage} />

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
        {/* Active Model Display Pill */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md border border-border">
            <Cpu className="w-3.5 h-3.5 text-accent" />
            <span>Active Model: <strong className="text-foreground">{activeModelName}</strong></span>
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
      </div>

      {/* Global Modals */}
      <FeedbackModal />
      <SettingsModal />
    </div>
  );
};
