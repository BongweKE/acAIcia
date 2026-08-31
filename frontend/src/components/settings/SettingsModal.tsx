import React from 'react';
import { useSettings, PROVIDER_OPTIONS } from '../../context/SettingsContext';
import { CustomInstructionsEditor } from './CustomInstructionsEditor';
import { X, Settings as SettingsIcon, Cpu, FileText, CheckCircle2 } from 'lucide-react';

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, closeSettings, activeProvider, activeModelName } = useSettings();
  const [activeTab, setActiveTab] = React.useState<'provider' | 'instructions'>('provider');

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-card-foreground">
        <div className="h-1.5 bg-accent shrink-0" />

        {/* Modal Header */}
        <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-accent/10 rounded-lg text-accent">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold font-serif">Settings & Research Preferences</h3>
              <p className="text-xs text-muted-foreground">Active Model: {activeModelName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSettings}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            aria-label="Close settings modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection Header */}
        <div className="flex border-b border-border bg-muted/40 px-5 pt-3 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('provider')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'provider'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Active System Model</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('instructions')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'instructions'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Custom Research Instructions</span>
          </button>
        </div>

        {/* Scrollable Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'provider' ? (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg border border-border text-xs text-muted-foreground space-y-1">
                <span className="font-semibold text-foreground">Admin Governed Model:</span> Model selection across acAIcia is managed by the administrator. Current active synthesis engine is <strong>{activeModelName}</strong>.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {PROVIDER_OPTIONS.map((prov) => {
                  const isSelected = activeProvider === prov.id || activeProvider.includes(prov.id);

                  return (
                    <div
                      key={prov.id}
                      className={`p-4 rounded-xl border text-left flex flex-col justify-between ${
                        isSelected
                          ? 'bg-accent/10 border-accent font-semibold text-foreground'
                          : 'bg-background border-border text-muted-foreground opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
                          <span>{prov.name}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />}
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground mt-2.5 leading-relaxed">
                        {prov.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <CustomInstructionsEditor />
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-muted/40 flex justify-end shrink-0">
          <button
            type="button"
            onClick={closeSettings}
            className="py-2 px-5 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-xs rounded-lg transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
