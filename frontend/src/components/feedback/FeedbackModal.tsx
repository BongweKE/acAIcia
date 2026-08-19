import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { X, MessageSquare, ThumbsUp, ThumbsDown, Send, FileWarning, Sparkles } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-forest-900 border border-forest-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-500" />

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                <FileWarning className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-sans">Submit Response Feedback</h3>
                <p className="text-xs text-gray-400">Help refine acAIcia RAG citations & evidence accuracy</p>
              </div>
            </div>
            <button
              onClick={closeFeedbackModal}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-forest-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Target Response Preview */}
          <div className="p-3 bg-forest-800/60 rounded-xl border border-forest-700/50 text-xs text-gray-300 space-y-1">
            <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
              Target Response Snippet
            </div>
            <p className="line-clamp-2 font-mono text-[11px] leading-relaxed text-gray-300">
              "{activeFeedbackMessage.content}"
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Quick Citation Feedback Presets */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Quick Citation & Issue Tags</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CITATION_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className="py-1 px-2.5 rounded-lg border border-forest-700/60 bg-forest-800/50 hover:bg-emerald-500/20 hover:border-emerald-500/40 text-[11px] text-gray-300 hover:text-emerald-300 transition-all text-left"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
                Evaluation Rating
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRating(1)}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                    rating === 1
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-glow'
                      : 'bg-forest-800/40 border-forest-700 text-gray-400 hover:text-white'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span>Upvote (+1)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRating(-1)}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                    rating === -1
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-lg'
                      : 'bg-forest-800/40 border-forest-700 text-gray-400 hover:text-white'
                  }`}
                >
                  <ThumbsDown className="w-4 h-4" />
                  <span>Needs Correction (-1)</span>
                </button>
              </div>
            </div>

            {/* Detailed Feedback Input */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
                Feedback / Citation Details
              </label>
              <textarea
                rows={3}
                placeholder="Specific paper DOI, missing [Author, Year] citation, or scientific correction..."
                value={correctionText}
                onChange={(e) => setCorrectionText(e.target.value)}
                className="w-full p-3 bg-forest-800/90 border border-forest-700 rounded-xl text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={closeFeedbackModal}
                className="flex-1 py-2 px-4 bg-forest-800 hover:bg-forest-700 text-gray-300 font-semibold text-xs rounded-xl border border-forest-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2 px-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-forest-950 font-semibold text-xs rounded-xl transition-all shadow-glow flex items-center justify-center gap-1.5"
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
