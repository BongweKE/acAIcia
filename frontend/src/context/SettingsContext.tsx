import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LLMProvider, UserProfile } from '../types';
import * as client from '../api/client';
import { useAuth } from './AuthContext';

export interface ProviderOption {
  id: LLMProvider;
  name: string;
  description: string;
  requiresAuth: boolean;
}

export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: 'modal_gemma',
    name: 'Modal Gemma 4',
    description: 'Fast, serverless open model deployed on Modal GPU infrastructure.',
    requiresAuth: false,
  },
  {
    id: 'gemini_2_5',
    name: 'Google Gemini 2.5 Flash',
    description: 'High-speed multimodal reasoning model optimized for agriscience search.',
    requiresAuth: true,
  },
  {
    id: 'nvidia_llama',
    name: 'NVIDIA Llama 3.3 70B',
    description: 'Ultra-large language model hosted on NVIDIA NIM microservices.',
    requiresAuth: true,
  },
  {
    id: 'deepseek_reasoner',
    name: 'DeepSeek Reasoner (R1)',
    description: 'Advanced chain-of-thought model for complex agriscience research synthesis.',
    requiresAuth: true,
  },
];

interface SettingsContextType {
  activeProvider: LLMProvider;
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
  const { user, role } = useAuth();
  const [activeProvider, setActiveProviderState] = useState<LLMProvider>('modal_gemma');
  const [customInstructions, setCustomInstructionsState] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Enforce guest provider lock
  useEffect(() => {
    if (role === 'guest') {
      setActiveProviderState('modal_gemma');
    }
  }, [role]);

  // Load user settings when user logs in
  useEffect(() => {
    if (user && user.email) {
      loadUserSettings(user.email);
    }
  }, [user]);

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await client.getSettings();
      if (res && res.llm_provider && role !== 'guest') {
        setActiveProviderState(res.llm_provider);
      }
    } catch (err) {
      console.warn('Failed to load global settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [role]);

  const loadUserSettings = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      const profile = await client.getUserSettings(userId);
      if (profile) {
        if (profile.custom_instructions) {
          setCustomInstructionsState(profile.custom_instructions);
        }
        if (profile.preferred_provider && role !== 'guest') {
          setActiveProviderState(profile.preferred_provider);
        }
      }
    } catch (err) {
      console.warn('Failed to load user settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [role]);

  const setProvider = useCallback(async (provider: LLMProvider) => {
    if (role === 'guest' && provider !== 'modal_gemma') {
      throw new Error('Guest users are locked to Modal Gemma 4. Please log in as a researcher to switch providers.');
    }

    setActiveProviderState(provider);
    
    try {
      await client.updateSettings({ llm_provider: provider });
      if (user && user.email) {
        await client.updateUserSettings({
          user_id: user.email,
          preferred_provider: provider,
        });
      }
    } catch (err) {
      console.warn('Failed to update provider backend settings:', err);
    }
  }, [role, user]);

  const setCustomInstructions = useCallback((instructions: string) => {
    setCustomInstructionsState(instructions);
  }, []);

  const saveCustomInstructions = useCallback(async (instructions: string) => {
    setCustomInstructionsState(instructions);
    if (!user || !user.email) return;

    try {
      await client.updateUserSettings({
        user_id: user.email,
        custom_instructions: instructions,
      });
    } catch (err) {
      console.error('Failed to save custom instructions:', err);
      throw err;
    }
  }, [user]);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  return (
    <SettingsContext.Provider
      value={{
        activeProvider,
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
