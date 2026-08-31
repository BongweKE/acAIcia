import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { X, ThumbsUp, ThumbsDown, Send, FileWarning, Sparkles } from 'lucide-react';

const CITATION_PRESETS = [
  "Inline [Author, Year] citation is missing or incomplete",
  "Incorrect author or year attributed to statement",
  "Source DOI link doesn't match referenced paper",
  "Response contains factually inaccurate scientific details",
  "Formatting or structural presentation issue"
];

export const FeedbackModal: React.FC = () => {
  const { activeFeedbackMessage, closeFeedbackModal, submitFeedback } = useChat();
  const [rating, setRating] = useState<1 | -1>(-1);
  const [correctionText, setCorrectionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!activeFeedbackMessage) return null;

  const logId = activeFeedbackMessage.queryId || activeFeedbackMessage.id;

  const handlePresetClick = (preset: string) => {
    setCorrectionText((prev) => (prev ? `${prev}; ${preset}` : preset));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await submitFeedback(logId, rating, correctionText.trim() || undefined);
      setCorrectionText('');
    } catch {
      // Toast handles error feedback
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-card-foreground">
        <div className="h-1.5 bg-accent" />

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-accent/10 rounded-lg text-accent">
                <FileWarning className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Submit Response Feedback</h3>
                <p className="text-xs text-muted-foreground">Help refine acAIcia RAG citations & evidence accuracy</p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeFeedbackModal}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Target Response Preview */}
          <div className="p-3 bg-muted rounded-lg border border-border text-xs text-muted-foreground space-y-1">
            <div className="text-[10px] font-semibold text-accent uppercase tracking-wider">
              Target Response Snippet
            </div>
            <p className="line-clamp-2 font-mono text-[11px] leading-relaxed">
              "{activeFeedbackMessage.content}"
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Quick Citation Feedback Presets */}
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-accent" />
                <span>Quick Citation & Issue Tags</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CITATION_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className="py-1 px-2.5 rounded-md border border-border bg-background hover:bg-accent/10 hover:border-accent/40 text-[11px] text-muted-foreground hover:text-accent transition-all text-left"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                Evaluation Rating
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRating(1)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                    rating === 1
                      ? 'bg-accent/10 border-accent text-accent font-semibold'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span>Upvote (+1)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRating(-1)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                    rating === -1
                      ? 'bg-destructive/10 border-destructive text-destructive font-semibold'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ThumbsDown className="w-4 h-4" />
                  <span>Needs Correction (-1)</span>
                </button>
              </div>
            </div>

            {/* Detailed Feedback Input */}
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                Feedback / Citation Details
              </label>
              <textarea
                rows={3}
                placeholder="Specific paper DOI, missing [Author, Year] citation, or scientific correction..."
                value={correctionText}
                onChange={(e) => setCorrectionText(e.target.value)}
                className="w-full p-3 bg-background border border-input rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={closeFeedbackModal}
                className="flex-1 py-2 px-4 bg-muted hover:bg-muted/80 text-muted-foreground font-semibold text-xs rounded-lg border border-border transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2 px-4 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-xs rounded-lg transition-all shadow flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Sending...' : 'Submit Feedback'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
