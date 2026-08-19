import React from 'react';
import { FeedbackEntry } from '../../types';
import { MessageSquare, ThumbsUp, ThumbsDown, Clock, User } from 'lucide-react';

interface RecentFeedbackTableProps {
  feedbackList: FeedbackEntry[];
}

export const RecentFeedbackTable: React.FC<RecentFeedbackTableProps> = ({ feedbackList }) => {
  return (
    <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/30">
            <MessageSquare className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-sans">Recent User Feedback & Citation Reports</h3>
            <p className="text-xs text-gray-400">Live feed of researcher ratings, citation corrections, and accuracy notes</p>
          </div>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-forest-800 text-emerald-400 border border-forest-700">
          {feedbackList.length} Entries
        </span>
      </div>

      {feedbackList.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-500 font-mono bg-forest-900/30 rounded-xl border border-forest-800/50">
          No feedback entries recorded yet. User upvotes and correction notes will appear here in real-time.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="text-[11px] uppercase tracking-wider text-gray-400 bg-forest-900/60 border-b border-forest-700/60">
              <tr>
                <th className="py-2.5 px-3">Rating</th>
                <th className="py-2.5 px-3">Feedback / Correction Comment</th>
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-800/60 font-sans">
              {feedbackList.map((item, idx) => {
                const isUp = item.rating === 1;
                const formattedTime = item.created_at
                  ? new Date(item.created_at).toLocaleString()
                  : 'Recent';

                return (
                  <tr key={item.feedback_id || idx} className="hover:bg-forest-800/30 transition-colors">
                    <td className="py-3 px-3">
                      {isUp ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium">
                          <ThumbsUp className="w-3 h-3" />
                          <span>Upvote (+1)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-medium">
                          <ThumbsDown className="w-3 h-3" />
                          <span>Correction (-1)</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 max-w-md">
                      {item.correction_text ? (
                        <p className="text-gray-200 text-xs font-mono bg-forest-900/40 p-2 rounded-lg border border-forest-800 leading-relaxed">
                          "{item.correction_text}"
                        </p>
                      ) : (
                        <span className="text-gray-500 italic text-[11px]">No text comment provided</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 text-gray-400 font-mono text-[11px]">
                        <User className="w-3 h-3 text-gray-500" />
                        <span className="truncate max-w-[120px]">{item.user_id || 'Guest'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 text-gray-400 text-[11px] font-mono whitespace-nowrap">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span>{formattedTime}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
