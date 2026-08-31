import React from 'react';
import { AboutView } from './AboutView';
import { FaqsView } from './FaqsView';
import { BlogsView } from './BlogsView';
import { ContactView } from './ContactView';
import { Info, HelpCircle, BookOpen, Mail, ArrowRight } from 'lucide-react';

export type NavTab = 'chat' | 'about' | 'faqs' | 'blogs' | 'contact' | 'admin';

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
      <div className="flex border-b border-border bg-card p-1.5 rounded-xl overflow-x-auto">
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
                isSelected
                  ? 'bg-accent text-accent-foreground shadow font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        {renderTabContent()}
      </div>

      {onNavigateToChat && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onNavigateToChat}
            className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-xs rounded-lg transition-colors shadow flex items-center gap-2"
          >
            <span>Launch Research Assistant</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
