import React, { useState } from 'react';
import { AcaiciaPageShell } from '../components/layout/AcaiciaPageShell';
import { MessageSquare, Send, ThumbsUp, ThumbsDown, CheckCircle2 } from 'lucide-react';
import { submitFeedback } from '../api/client';
import { useToast } from '../context/ToastContext';

export const FeedbackPage: React.FC = () => {
  const { addToast } = useToast();
  const [rating, setRating] = useState<1 | -1>(1);
  const [correctionText, setCorrectionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      await submitFeedback({
        rating,
        correction_text: correctionText.trim() || undefined,
      });
      setIsSubmitted(true);
      addToast('Thank you! Your citation feedback has been logged.', 'success');
    } catch (err: any) {
      addToast(`Error submitting feedback: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AcaiciaPageShell
      eyebrow="Quality Control & Review"
      title="Help us improve citation accuracy."
      description="Spotted an inaccurate citation, missing publication, or contextual nuance? Submit your notes directly to the acAIcia evaluation pipeline."
    >
      <div className="mx-auto max-w-3xl px-6 py-16 lg:px-10 lg:py-24">
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          {isSubmitted ? (
            <div className="text-center py-10 space-y-4">
              <CheckCircle2 className="h-12 w-12 text-accent mx-auto" />
              <h2 className="font-serif text-2xl font-medium">Feedback Received</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Thank you for contributing to the acAIcia evidence synthesis system. Your notes have been sent to our evaluation team.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                  setCorrectionText('');
                }}
                className="mt-4 inline-flex items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground"
              >
                Submit another note
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-3">Overall Citation Rating</label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setRating(1)}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      rating === 1
                        ? 'border-accent bg-accent/10 text-accent font-semibold'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <ThumbsUp className="h-4 w-4" /> Accurate Citations
                  </button>
                  <button
                    type="button"
                    onClick={() => setRating(-1)}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      rating === -1
                        ? 'border-destructive bg-destructive/10 text-destructive font-semibold'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <ThumbsDown className="h-4 w-4" /> Needs Correction
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="correction" className="block text-sm font-semibold mb-2">
                  Feedback / Citation Notes
                </label>
                <textarea
                  id="correction"
                  rows={5}
                  required
                  placeholder="Describe any missing papers, author/year mismatch, or specific research nuances..."
                  className="w-full resize-none rounded-lg border border-input bg-background p-4 text-sm text-foreground shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  value={correctionText}
                  onChange={(e) => setCorrectionText(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !correctionText.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow transition-colors hover:bg-accent/90 disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'} <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </AcaiciaPageShell>
  );
};
