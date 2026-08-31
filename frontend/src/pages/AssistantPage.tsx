import React from 'react';
import { AcaiciaPageShell } from '../components/layout/AcaiciaPageShell';
import { ChatArea } from '../components/chat/ChatArea';

export const AssistantPage: React.FC = () => {
  return (
    <AcaiciaPageShell
      eyebrow="Ask acAIcia"
      title="Your research questions, grounded in evidence."
      description="Type any question about agroforestry, soil science, climate adaptation, food systems, or natural resource management to synthesize peer-reviewed findings."
    >
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-16">
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <ChatArea />
        </div>
      </div>
    </AcaiciaPageShell>
  );
};
