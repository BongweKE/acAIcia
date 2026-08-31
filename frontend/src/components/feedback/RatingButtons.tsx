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

  const logId = message.queryId || message.id;

  const handleUpvote = async () => {
    if (isSubmitting) return;

    if (rated === 'up') {
      setRated(null);
      return;
    }

    try {
      setIsSubmitting(true);
      setRated('up');
      await submitFeedback(logId, 1);
    } catch {
      // Handled in context toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownvote = () => {
    openFeedbackModal(message);
    setRated('down');
  };

  return (
    <div className="flex items-center gap-1.5 pt-1">
      <button
        type="button"
        onClick={handleUpvote}
        disabled={isSubmitting}
        className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 ${
          rated === 'up'
            ? 'bg-accent/10 text-accent border-accent/40 font-semibold'
            : 'bg-card text-muted-foreground hover:text-foreground border-border hover:bg-muted'
        }`}
        title="Helpful & accurate response (Upvote)"
      >
        {rated === 'up' ? <Check className="w-3.5 h-3.5 text-accent" /> : <ThumbsUp className="w-3.5 h-3.5" />}
        {rated === 'up' && <span className="text-[11px]">Helpful</span>}
      </button>

      <button
        type="button"
        onClick={handleDownvote}
        disabled={isSubmitting}
        className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 ${
          rated === 'down'
            ? 'bg-destructive/10 text-destructive border-destructive/40 font-semibold'
            : 'bg-card text-muted-foreground hover:text-foreground border-border hover:bg-muted'
        }`}
        title="Needs correction or feedback (Downvote)"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={handleDownvote}
        className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted text-xs transition-colors flex items-center gap-1"
        title="Report citation feedback"
      >
        <FileWarning className="w-3.5 h-3.5 text-accent" />
        <span className="text-[11px] hidden sm:inline">Citation feedback</span>
      </button>
    </div>
  );
};
