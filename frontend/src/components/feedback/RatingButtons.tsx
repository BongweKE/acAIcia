import React, { useState } from 'react';
import { ChatMessage } from '../../types';
import { useChat } from '../../context/ChatContext';
import { ThumbsUp, ThumbsDown, Check, FileWarning } from 'lucide-react';

interface RatingButtonsProps {
  message: ChatMessage;
}

export const RatingButtons: React.FC<RatingButtonsProps> = ({ message }) => {
  const { openFeedbackModal, submitFeedback } = useChat();
  const [rated, setRated] = useState<'up' | 'down' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [animateUp, setAnimateUp] = useState(false);

  const logId = message.queryId || message.id;

  const handleUpvote = async () => {
    if (isSubmitting) return;

    // Toggle off if already upvoted
    if (rated === 'up') {
      setRated(null);
      return;
    }

    try {
      setIsSubmitting(true);
      setAnimateUp(true);
      setRated('up');
      await submitFeedback(logId, 1);
      setTimeout(() => setAnimateUp(false), 500);
    } catch {
      // Toast notification is handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownvote = () => {
    openFeedbackModal(message);
    setRated('down');
  };

  const handleCitationReport = () => {
    openFeedbackModal(message);
    setRated('down');
  };

  return (
    <div className="flex items-center gap-1.5 pt-1">
      {/* Upvote Button with Micro-Animation */}
      <button
        onClick={handleUpvote}
        disabled={isSubmitting}
        className={`p-1.5 rounded-lg border text-xs transition-all duration-200 flex items-center gap-1.5 ${
          animateUp ? 'scale-125 ring-2 ring-emerald-400/50' : 'scale-100'
        } ${
          rated === 'up'
            ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-glow'
            : 'bg-forest-800/40 hover:bg-forest-800/80 text-gray-400 hover:text-emerald-300 border-forest-700/50 hover:border-emerald-500/30'
        }`}
        title="Helpful & accurate response (Upvote)"
      >
        {rated === 'up' ? (
          <Check className="w-3.5 h-3.5 text-emerald-400 animate-in zoom-in-75 duration-150" />
        ) : (
          <ThumbsUp className="w-3.5 h-3.5 transition-transform group-hover:-rotate-12" />
        )}
        <span className="text-[11px] font-medium">{rated === 'up' ? 'Helpful' : ''}</span>
      </button>

      {/* Downvote / Correction Button */}
      <button
        onClick={handleDownvote}
        disabled={isSubmitting}
        className={`p-1.5 rounded-lg border text-xs transition-all duration-200 flex items-center gap-1.5 ${
          rated === 'down'
            ? 'bg-rose-500/25 text-rose-300 border-rose-500/50 shadow-md'
            : 'bg-forest-800/40 hover:bg-forest-800/80 text-gray-400 hover:text-rose-300 border-forest-700/50 hover:border-rose-500/30'
        }`}
        title="Needs correction or feedback (Downvote)"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>

      {/* Report Citation Issue Overlay Button */}
      <button
        onClick={handleCitationReport}
        className="p-1.5 rounded-lg border border-forest-700/50 bg-forest-800/40 hover:bg-forest-800/80 text-gray-400 hover:text-amber-300 hover:border-amber-500/30 text-xs transition-all duration-200 flex items-center gap-1"
        title="Report missing or incorrect citation ([Author, Year])"
      >
        <FileWarning className="w-3.5 h-3.5 text-amber-400/80" />
        <span className="text-[11px] text-gray-400 hover:text-amber-300 hidden sm:inline">Citation Feedback</span>
      </button>
    </div>
  );
};
