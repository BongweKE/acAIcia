import React from 'react';
import { NavTab } from '../layout/Sidebar';
import { AboutView } from './AboutView';
import { FaqsView } from './FaqsView';
import { BlogsView } from './BlogsView';
import { ContactView } from './ContactView';
import { Info, HelpCircle, BookOpen, Mail, ArrowRight } from 'lucide-react';

interface InfoViewProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onNavigateToChat?: () => void;
}

export const InfoView: React.FC<InfoViewProps> = ({
  activeTab,
  onSelectTab,
  onNavigateToChat,
}) => {
  const tabs = [
    { id: 'about' as NavTab, label: 'About acAIcia', icon: <Info className="w-4 h-4" /> },
    { id: 'faqs' as NavTab, label: 'FAQs', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'blogs' as NavTab, label: 'Research Blogs', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'contact' as NavTab, label: 'Contact Support', icon: <Mail className="w-4 h-4" /> },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'about':
        return <AboutView />;
      case 'faqs':
        return <FaqsView />;
      case 'blogs':
        return <BlogsView />;
      case 'contact':
        return <ContactView />;
      default:
        return <AboutView />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Tab Bar for Info Views */}
      <div className="flex border-b border-forest-800 bg-forest-950/40 p-1.5 rounded-2xl overflow-x-auto">
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
                isSelected
                  ? 'bg-emerald-500 text-forest-950 shadow-glow font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-forest-800/60'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Rendered Info View Content */}
      <div className="bg-forest-800/30 border border-forest-700/60 rounded-2xl p-6 shadow-xl">
        {renderTabContent()}
      </div>

      {/* Return to Chat Button */}
      {onNavigateToChat && (
        <div className="flex justify-end pt-2">
          <button
            onClick={onNavigateToChat}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-forest-950 font-bold text-xs rounded-xl transition-all shadow-glow flex items-center gap-2"
          >
            <span>Launch RAG Research Assistant</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
