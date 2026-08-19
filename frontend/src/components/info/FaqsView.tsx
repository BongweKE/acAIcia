import React from 'react';
import { HelpCircle, ChevronRight, Lock, Key, Link2, ThumbsUp, Sliders } from 'lucide-react';

export const FaqsView: React.FC = () => {
  const faqs = [
    {
      q: 'How does Guest Mode vs Authenticated Researcher Mode work?',
      icon: <Lock className="w-4 h-4 text-amber-400" />,
      a: 'Guest sessions track query usage (up to 20 queries max per browser session) and are locked to the fast, serverless Modal Gemma 4 model. Logging in as an Authenticated Researcher unlocks unlimited queries, Gemini 2.5 Flash, NVIDIA NIM Llama 3.3, DeepSeek Reasoner, and Custom Instructions editing.',
    },
    {
      q: 'What LLM models are supported and how do I switch providers?',
      icon: <Key className="w-4 h-4 text-emerald-400" />,
      a: 'acAIcia supports Modal Gemma 4, Google Gemini 2.5 Flash, NVIDIA NIM Llama 3.3 70B, and DeepSeek Reasoner (R1). Authenticated users can open the Settings modal (gear icon in header or top-left model pill) to switch the active synthesis provider instantly.',
    },
    {
      q: 'How are source citations verified and linked via DOIs?',
      icon: <Link2 className="w-4 h-4 text-teal-400" />,
      a: 'Every answer synthesized by acAIcia includes inline [Author, Year] citations corresponding to retrieved document cards. Clicking a source chunk card displays full publication metadata and direct https://doi.org/... resolution links.',
    },
    {
      q: 'How does the interactive feedback logging system work?',
      icon: <ThumbsUp className="w-4 h-4 text-blue-400" />,
      a: 'Each assistant message has Upvote and Downvote buttons. Clicking thumbs-down opens a correction modal where researchers can submit detailed feedback. Feedback is logged to POST /feedback to continuously fine-tune retrieval rerankers and guardian filters.',
    },
    {
      q: 'Can I customize the synthesis agent for specific regional contexts?',
      icon: <Sliders className="w-4 h-4 text-purple-400" />,
      a: 'Yes! In the Settings modal, authenticated researchers can set Custom Instructions (e.g. "Focus responses on East African smallholder agroforestry systems..."). These preferences are saved to your profile and appended to the synthesis prompt.',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2">
        <HelpCircle className="w-5 h-5 text-emerald-400" />
        <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider">
          Frequently Asked Questions
        </h2>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, idx) => (
          <div
            key={idx}
            className="p-4 bg-forest-800/40 border border-forest-700/60 rounded-2xl space-y-2 hover:border-forest-600 transition-colors"
          >
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-forest-900 rounded-lg border border-forest-700 shrink-0 mt-0.5">
                {faq.icon}
              </div>
              <h3 className="font-bold text-sm text-white font-sans">{faq.q}</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed pl-8">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
