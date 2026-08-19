import React from 'react';
import { NavTab } from '../components/layout/Sidebar';
import { InfoView } from '../components/info/InfoView';
import { Info, HelpCircle, BookOpen, Mail } from 'lucide-react';

interface InfoPageProps {
  tab: NavTab;
  onNavigateToChat?: () => void;
  onSelectTab?: (tab: NavTab) => void;
}

export const InfoPage: React.FC<InfoPageProps> = ({ tab, onNavigateToChat, onSelectTab }) => {
  const getHeaderMeta = () => {
    switch (tab) {
      case 'about':
        return {
          title: 'About acAIcia',
          subtitle: 'Agriscience AI Assistant for Sustainable Agriculture & Agroforestry',
          icon: <Info className="w-6 h-6 text-emerald-400" />,
        };
      case 'faqs':
        return {
          title: 'Frequently Asked Questions',
          subtitle: 'Common inquiries on RAG search, LLM models, and DOI citations',
          icon: <HelpCircle className="w-6 h-6 text-emerald-400" />,
        };
      case 'blogs':
        return {
          title: 'Agriscience Research Articles',
          subtitle: 'Latest publication breakdowns in soil carbon & agroforestry systems',
          icon: <BookOpen className="w-6 h-6 text-emerald-400" />,
        };
      case 'contact':
        return {
          title: 'Contact & Support',
          subtitle: 'Technical support, partner inquiries, and dataset feedback',
          icon: <Mail className="w-6 h-6 text-emerald-400" />,
        };
      default:
        return {
          title: 'About acAIcia',
          subtitle: 'Agriscience AI Assistant for Sustainable Agriculture',
          icon: <Info className="w-6 h-6 text-emerald-400" />,
        };
    }
  };

  const meta = getHeaderMeta();

  const handleTabChange = (selectedTab: NavTab) => {
    if (onSelectTab) {
      onSelectTab(selectedTab);
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full p-4 sm:p-8 space-y-6">
      {/* Header Banner */}
      <div className="flex items-center gap-3 pb-4 border-b border-forest-800">
        <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 shadow-glow">
          {meta.icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white font-sans">{meta.title}</h1>
          <p className="text-xs text-gray-400">{meta.subtitle}</p>
        </div>
      </div>

      {/* Main Tabbed Info View */}
      <InfoView
        activeTab={tab}
        onSelectTab={handleTabChange}
        onNavigateToChat={onNavigateToChat}
      />
    </div>
  );
};
