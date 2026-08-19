import React, { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { FileText, Save, AlertCircle, Sparkles } from 'lucide-react';

export const CustomInstructionsEditor: React.FC = () => {
  const { customInstructions, saveCustomInstructions } = useSettings();
  const { role } = useAuth();
  const { addToast } = useToast();

  const [text, setText] = useState(customInstructions);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setText(customInstructions);
  }, [customInstructions]);

  const handleSave = async () => {
    if (role === 'guest') {
      addToast('Please login as a researcher to customize synthesis agent instructions.', 'warning');
      return;
    }

    try {
      setIsSaving(true);
      await saveCustomInstructions(text);
      addToast('Custom synthesis instructions saved successfully!', 'success');
    } catch (err: any) {
      addToast(`Failed to save instructions: ${err.message || 'Error'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const applyPreset = (presetText: string) => {
    if (role === 'guest') {
      addToast('Login required to edit instructions.', 'warning');
      return;
    }
    setText(presetText);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
            Synthesis Agent Custom Instructions
          </h4>
        </div>
        {role === 'guest' && (
          <span className="text-[11px] text-amber-400 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3" /> Login Required
          </span>
        )}
      </div>

      <p className="text-xs text-gray-400 leading-relaxed">
        Instruct the synthesis engine to focus on specific crop varieties, regional agricultural contexts (e.g. East Africa smallholders), or citation formatting preferences.
      </p>

      {/* Preset Quick Actions */}
      {role !== 'guest' && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-gray-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Preset Research Templates:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                applyPreset(
                  'Focus responses on East African smallholder agroforestry systems (Grevillea, Acacia, Sesbania). Emphasize soil carbon sequestration and nitrogen fixation dynamics.'
                )
              }
              className="px-2.5 py-1 bg-forest-800 hover:bg-forest-700 border border-forest-700/80 rounded-lg text-[11px] text-emerald-300 transition-colors"
            >
              East Africa Agroforestry
            </button>
            <button
              type="button"
              onClick={() =>
                applyPreset(
                  'Prioritize peer-reviewed CIFOR-ICRAF & FAO publications from 2020 to 2026. Provide quantitative metrics for crop yields and shade density.'
                )
              }
              className="px-2.5 py-1 bg-forest-800 hover:bg-forest-700 border border-forest-700/80 rounded-lg text-[11px] text-emerald-300 transition-colors"
            >
              CIFOR-ICRAF Peer-Reviewed
            </button>
          </div>
        </div>
      )}

      <textarea
        rows={5}
        disabled={role === 'guest'}
        placeholder={
          role === 'guest'
            ? 'Log in to customize research synthesis instructions...'
            : 'Example: Focus response on smallholder agroforestry systems in Sub-Saharan Africa. Prioritize peer-reviewed studies published after 2018...'
        }
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full p-3 bg-forest-900/90 border border-forest-700 rounded-xl text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all disabled:opacity-50 resize-none font-mono"
      />

      {role !== 'guest' && (
        <div className="flex justify-between items-center pt-1">
          <span className="text-[11px] text-gray-500 font-mono">
            {text.length} characters
          </span>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-forest-950 font-semibold text-xs rounded-xl transition-all shadow-glow flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Custom Instructions'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
