import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LLMProvider } from '../types';
import * as client from '../api/client';

export interface ProviderOption {
  id: LLMProvider;
  name: string;
  description: string;
}

export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: 'mistral',
    name: 'Mistral Small 4',
    description: 'Mistral AI 119B MoE model with Shieldstral 1.0 safety guard — default provider.',
  },
  {
    id: 'gemini',
    name: 'Google Gemini 2.5 Flash',
    description: 'High-speed reasoning model optimized for agriscience search.',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA Llama 3.3 70B',
    description: 'Ultra-large language model hosted on NVIDIA NIM microservices.',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek Reasoner (R1)',
    description: 'Advanced reasoning model for complex agriscience research synthesis.',
  },
];

interface SettingsContextType {
  activeProvider: LLMProvider;
  activeModelName: string;
  setProvider: (provider: LLMProvider) => Promise<void>;
  customInstructions: string;
  setCustomInstructions: (instructions: string) => void;
  saveCustomInstructions: (instructions: string) => Promise<void>;
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeProvider, setActiveProviderState] = useState<LLMProvider>('mistral');
  const [customInstructions, setCustomInstructionsState] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await client.getSettings();
      if (res && res.llm_provider) {
        setActiveProviderState(res.llm_provider);
      }
    } catch (err) {
      console.warn('Failed to load active LLM settings from backend:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const setProvider = useCallback(async (provider: LLMProvider) => {
    setActiveProviderState(provider);
    try {
      await client.updateSettings({ llm_provider: provider });
    } catch (err) {
      console.warn('Failed to update provider backend settings:', err);
      throw err;
    }
  }, []);

  const setCustomInstructions = useCallback((instructions: string) => {
    setCustomInstructionsState(instructions);
  }, []);

  const saveCustomInstructions = useCallback(async (instructions: string) => {
    setCustomInstructionsState(instructions);
  }, []);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  const activeOption = PROVIDER_OPTIONS.find(p => p.id === activeProvider || p.id === activeProvider.replace('_', ''));
  const activeModelName = activeOption ? activeOption.name : activeProvider;

  return (
    <SettingsContext.Provider
      value={{
        activeProvider,
        activeModelName,
        setProvider,
        customInstructions,
        setCustomInstructions,
        saveCustomInstructions,
        isSettingsOpen,
        openSettings,
        closeSettings,
        isLoading,
        loadSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
