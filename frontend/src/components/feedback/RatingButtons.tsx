import React, { useState } from 'react';
import { ChatMessage } from '../../types';
import { useChat } from '../../context/ChatContext';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';

interface RatingButtonsProps {
  message: ChatMessage;
}

export const RatingButtons: React.FC<RatingButtonsProps> = ({ message }) => {
  const { openFeedbackModal, submitFeedback } = useChat();
  const [rated, setRated] = useState<'up' | 'down' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const logId = message.queryId || message.id;

  const handleUpvote = async () => {
    if (rated === 'up' || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await submitFeedback(logId, 1);
      setRated('up');
    } catch {
      // toast shown in context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownvote = () => {
    openFeedbackModal(message);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleUpvote}
        disabled={isSubmitting}
        className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 ${
          rated === 'up'
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            : 'bg-forest-800/40 hover:bg-forest-800 text-gray-400 hover:text-emerald-300 border-forest-700/50'
        }`}
        title="Helpful response (Upvote)"
      >
        {rated === 'up' ? <Check className="w-3.5 h-3.5" /> : <ThumbsUp className="w-3.5 h-3.5" />}
      </button>

      <button
        onClick={handleDownvote}
        disabled={isSubmitting}
        className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 ${
          rated === 'down'
            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            : 'bg-forest-800/40 hover:bg-forest-800 text-gray-400 hover:text-rose-300 border-forest-700/50'
        }`}
        title="Provide feedback or correction (Downvote)"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
