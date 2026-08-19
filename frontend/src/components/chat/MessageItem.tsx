import React, { useState } from 'react';
import { ChatMessage } from '../../types';
import { SourceCard } from './SourceCard';
import { RatingButtons } from '../feedback/RatingButtons';
import Markdown from 'markdown-to-jsx';
import { Sprout, User, Zap, BookOpen, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface MessageItemProps {
  message: ChatMessage;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const [showSources, setShowSources] = useState(true);
  const isUser = message.role === 'user';
  const isProcessing = message.status === 'processing';

  // Helper to format inline citation badges [Author, Year] into custom elements or styled spans
  const formatCitations = (text: string) => {
    // Return formatted markdown where [Author, Year] citations have special badge formatting if desired
    return text;
  };

  return (
    <div className={`flex gap-3.5 py-4 px-3 sm:px-5 rounded-2xl transition-colors ${
      isUser
        ? 'bg-forest-800/30 border border-forest-700/30'
        : 'bg-forest-800/60 border border-forest-700/60 shadow-md'
    }`}>
      {/* Avatar Icon */}
      <div className="shrink-0">
        {isUser ? (
          <div className="w-8 h-8 rounded-xl bg-forest-700 border border-forest-600 flex items-center justify-center text-gray-300">
            <User className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-glow">
            <Sprout className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Content Container */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Header line: Role name, timestamp, cache hit badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-200">
              {isUser ? 'You' : 'acAIcia Assistant'}
            </span>
            {message.timestamp && (
              <span className="text-[11px] text-gray-400 font-mono">{message.timestamp}</span>
            )}
          </div>

          {!isUser && (
            <div className="flex items-center gap-2">
              {message.cacheHit && (
                <div
                  className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-[10px] font-semibold text-emerald-300 flex items-center gap-1"
                  title="Response served instantly from Semantic Cache"
                >
                  <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                  <span>Cache Hit</span>
                </div>
              )}
              {message.status === 'completed' && <RatingButtons message={message} />}
            </div>
          )}
        </div>

        {/* Message Body */}
        {isUser ? (
          <div className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed font-sans">
            {message.content}
          </div>
        ) : (
          <div className="space-y-3">
            {isProcessing ? (
              <div className="flex items-center gap-2 text-sm text-emerald-300 py-1 font-mono">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Synthesising peer-reviewed evidence...</span>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none text-sm text-gray-200 leading-relaxed font-sans prose-p:my-2 prose-headings:text-emerald-300 prose-a:text-emerald-400 prose-strong:text-white prose-code:text-emerald-300 prose-code:bg-forest-900/80 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
                <Markdown
                  options={{
                    overrides: {
                      // Custom citation badge styling override if citation pattern matches
                    },
                  }}
                >
                  {formatCitations(message.content)}
                </Markdown>
              </div>
            )}

            {/* Source Cards Section */}
            {message.sources && message.sources.length > 0 && (
              <div className="pt-3 border-t border-forest-700/50 space-y-2.5">
                <button
                  onClick={() => setShowSources(!showSources)}
                  className="flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>
                    Retrieved Peer-Reviewed Sources ({message.sources.length})
                  </span>
                  {showSources ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {showSources && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {message.sources.map((source, idx) => (
                      <SourceCard key={idx} source={source} index={idx} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
