import React, { useState, useMemo } from 'react';
import { ChatMessage } from '../../types';
import { SourceCard } from './SourceCard';
import { RatingButtons } from '../feedback/RatingButtons';
import { LoadingMessage } from './LoadingMessage';
import Markdown from 'markdown-to-jsx';
import { User, Zap, BookOpen, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface MessageItemProps {
  message: ChatMessage;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const [showSources, setShowSources] = useState(true);
  const isUser = message.role === 'user';
  const isProcessing = message.status === 'processing';

  const enrichedSources = useMemo(() => {
    if (!message.sources || message.sources.length === 0 || !message.content) return message.sources;
    // If backend already set cited flags, use them
    if (message.sources.some(s => s.cited !== undefined)) return message.sources;
    
    // Client-side fallback: scan message content for [Author, Year] citation tags
    const citationPattern = /\[([A-Za-z\u00C0-\u024F\-\s\'.&]+?(?:\s+et\s+al\.)?),?\s*(\d{4})\]/g;
    const citations = [...message.content.matchAll(citationPattern)];
    
    if (citations.length === 0) return message.sources;
    
    return message.sources.map(source => {
      const authorsStr = typeof source.authors === 'string' ? source.authors : '';
      const surname = authorsStr.split(',')[0].trim().split(' ').pop()?.toLowerCase() || '';
      const yearStr = String(source.year);
      
      const isCited = citations.some(([, authorText, year]) => {
        return surname && authorText.toLowerCase().includes(surname) && year === yearStr;
      });
      
      return { ...source, cited: isCited };
    });
  }, [message.sources, message.content]);

  return (
    <div
      className={`flex gap-3.5 py-4 px-4 sm:px-5 rounded-xl border transition-colors ${
        isUser
          ? 'bg-muted/40 border-border/60'
          : 'bg-card border-border shadow-sm'
      }`}
    >
      {/* Avatar Icon */}
      <div className="shrink-0">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
            <User className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
            <img src="/logo-new.svg" alt="" className="h-5 w-5 object-contain" />
          </div>
        )}
      </div>

      {/* Content Container */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Header line */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              {isUser ? 'You' : 'acAIcia Assistant'}
            </span>
            {message.timestamp && (
              <span className="text-[11px] text-muted-foreground font-mono">{message.timestamp}</span>
            )}
          </div>

          {!isUser && (
            <div className="flex items-center gap-2">
              {message.cacheHit && (
                <div
                  className="px-2 py-0.5 rounded-md bg-accent/10 border border-accent/30 text-[10px] font-semibold text-accent flex items-center gap-1"
                  title="Response served instantly from Semantic Cache"
                >
                  <Zap className="w-3 h-3 text-accent fill-accent" />
                  <span>Cache Hit</span>
                </div>
              )}
              {message.status === 'completed' && <RatingButtons message={message} />}
            </div>
          )}
        </div>

        {/* Message Body */}
        {isUser ? (
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-sans">
            {message.content}
          </div>
        ) : (
          <div className="space-y-3">
            {isProcessing ? (
              <LoadingMessage />
            ) : (
              <div className="prose max-w-none text-sm text-foreground leading-relaxed font-sans prose-p:my-2 prose-headings:text-foreground prose-a:text-accent prose-strong:text-foreground prose-code:text-accent prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
                <Markdown>{message.content}</Markdown>
              </div>
            )}

            {/* Source Cards Section */}
            {enrichedSources && enrichedSources.length > 0 && (
              <div className="pt-3 border-t border-border space-y-2.5">
                <button
                  type="button"
                  onClick={() => setShowSources(!showSources)}
                  className="flex items-center gap-2 text-xs font-semibold text-accent hover:underline transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>
                    Retrieved Peer-Reviewed Sources ({enrichedSources.length})
                  </span>
                  {showSources ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {showSources && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {enrichedSources.map((source, idx) => (
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
