import React, { useState } from 'react';
import { useSettings, PROVIDER_OPTIONS } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { CustomInstructionsEditor } from './CustomInstructionsEditor';
import { X, Settings as SettingsIcon, Cpu, Lock, CheckCircle2, LogIn, FileText, Sliders } from 'lucide-react';

type SettingsTab = 'provider' | 'instructions';

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, closeSettings, activeProvider, setProvider } = useSettings();
  const { role, openLoginModal } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>('provider');

  if (!isSettingsOpen) return null;

  const handleSelectProvider = async (providerId: string) => {
    if (role === 'guest' && providerId !== 'modal_gemma') {
      addToast('Guest access is locked to Modal Gemma 4. Log in as a Researcher to select other models.', 'warning');
      return;
    }

    try {
      await setProvider(providerId);
      addToast(`Active LLM Provider changed to ${providerId}`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to change provider', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-forest-900 border border-forest-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 shrink-0" />

        {/* Modal Header */}
        <div className="p-5 border-b border-forest-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
              <SettingsIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-sans">Settings & Provider Configuration</h3>
              <p className="text-xs text-gray-400">Configure LLM Synthesis Engine & Research Preferences</p>
            </div>
          </div>
          <button
            onClick={closeSettings}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-forest-800 transition-colors"
            aria-label="Close settings modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection Header */}
        <div className="flex border-b border-forest-800 bg-forest-950/50 px-5 pt-3 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('provider')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'provider'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-forest-700'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>LLM Provider Selection</span>
          </button>
          <button
            onClick={() => setActiveTab('instructions')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'instructions'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-forest-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Custom Instructions</span>
          </button>
        </div>

        {/* Scrollable Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Guest Lock Banner */}
          {role === 'guest' && (
            <div className="p-3.5 bg-amber-950/30 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Guest mode is locked to <strong>Modal Gemma 4</strong>. Login as a researcher to unlock Gemini 2.5, NVIDIA Llama 3.3 & DeepSeek Reasoner.
                </span>
              </div>
              <button
                onClick={() => {
                  closeSettings();
                  openLoginModal();
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-forest-950 font-bold rounded-lg shrink-0 flex items-center gap-1 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Login</span>
              </button>
            </div>
          )}

          {activeTab === 'provider' ? (
            /* Tab 1: Model Provider Selector */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                    Select LLM Synthesis Engine
                  </h4>
                </div>
                <span className="text-[11px] text-gray-400">
                  Current: <strong className="text-emerald-300 font-mono">{activeProvider}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {PROVIDER_OPTIONS.map((prov) => {
                  const isSelected = activeProvider === prov.id;
                  const isLocked = role === 'guest' && prov.requiresAuth;

                  return (
                    <button
                      key={prov.id}
                      onClick={() => handleSelectProvider(prov.id)}
                      className={`p-4 rounded-xl border text-left transition-all duration-200 relative flex flex-col justify-between ${
                        isSelected
                          ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-glow ring-1 ring-emerald-500/50'
                          : isLocked
                          ? 'bg-forest-950/40 border-forest-800/80 text-gray-500 cursor-not-allowed opacity-65 hover:border-forest-700'
                          : 'bg-forest-800/50 hover:bg-forest-800 border-forest-700/60 text-gray-200 hover:border-emerald-500/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-xs flex items-center gap-1.5 text-gray-100">
                          <span>{prov.name}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                        </div>
                        {isLocked && (
                          <span className="px-2 py-0.5 rounded bg-forest-900 border border-amber-500/30 text-[10px] text-amber-400 font-mono flex items-center gap-1 shrink-0">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-gray-400 mt-2.5 leading-relaxed">
                        {prov.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Tab 2: Custom Instructions Editor */
            <CustomInstructionsEditor />
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-forest-800 bg-forest-950/40 flex justify-end shrink-0">
          <button
            onClick={closeSettings}
            className="py-2 px-5 bg-emerald-500 hover:bg-emerald-600 text-forest-950 font-semibold text-xs rounded-xl transition-all shadow-glow"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
