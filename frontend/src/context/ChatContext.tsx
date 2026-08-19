import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage, SourceChunk, QueryStatusResponse } from '../types';
import * as client from '../api/client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

export type RAGStage = 'Guardian Check' | 'Query Architect' | 'Hybrid Retrieval' | 'Synthesis Engine' | null;

interface ChatContextType {
  messages: ChatMessage[];
  pills: string[];
  fetchPills: () => Promise<void>;
  isProcessing: boolean;
  currentQueryId: string | null;
  currentStage: RAGStage;
  activeFeedbackMessage: ChatMessage | null;
  openFeedbackModal: (message: ChatMessage) => void;
  closeFeedbackModal: () => void;
  submitUserQuery: (queryText: string) => Promise<void>;
  submitFeedback: (logId: string, rating: 1 | -1, correctionText?: string) => Promise<void>;
  clearChat: () => void;
}

const DEFAULT_PILLS = [
  "What are the best agroforestry practices for soil nitrogen fixation?",
  "How does climate change impact maize yield in East Africa?",
  "Compare organic vs synthetic fertilizer environmental footprints",
  "Explain integrated pest management for coffee rust disease",
];

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-msg',
  role: 'assistant',
  content: `Welcome to **acAIcia** — your intelligent Agriscience AI assistant! 🌿\n\nAsk any question about agricultural research, crop science, agroforestry, soil health, or sustainable farming practices. You will receive synthesised evidence backed by peer-reviewed literature and clickable DOI citations.`,
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  status: 'completed',
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, guestQueryCount, decrementGuestQueryCount, user } = useAuth();
  const { addToast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME_MESSAGE]);
  const [pills, setPills] = useState<string[]>(DEFAULT_PILLS);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<RAGStage>(null);
  const [activeFeedbackMessage, setActiveFeedbackMessage] = useState<ChatMessage | null>(null);

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-fetch prompt pills on mount
  const fetchPills = useCallback(async () => {
    try {
      const res = await client.getPromptPills();
      if (res && res.pills && res.pills.length > 0) {
        setPills(res.pills);
      }
    } catch (err) {
      console.warn('Failed to fetch prompt pills, using defaults:', err);
    }
  }, []);

  useEffect(() => {
    fetchPills();
  }, [fetchPills]);

  // Clear polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, []);

  const openFeedbackModal = useCallback((message: ChatMessage) => {
    setActiveFeedbackMessage(message);
  }, []);

  const closeFeedbackModal = useCallback(() => {
    setActiveFeedbackMessage(null);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([INITIAL_WELCOME_MESSAGE]);
    setIsProcessing(false);
    setCurrentQueryId(null);
    setCurrentStage(null);
  }, []);

  const pollQueryStatus = useCallback((queryId: string, assistantMsgId: string) => {
    let pollCount = 0;

    // Helper to map polling ticks/stages to RAG stage indicators
    const updateStage = (tick: number, backendStage?: string) => {
      if (backendStage) {
        if (backendStage.toLowerCase().includes('guardian')) return 'Guardian Check';
        if (backendStage.toLowerCase().includes('architect')) return 'Query Architect';
        if (backendStage.toLowerCase().includes('retriev')) return 'Hybrid Retrieval';
        if (backendStage.toLowerCase().includes('synthes')) return 'Synthesis Engine';
      }
      if (tick <= 1) return 'Guardian Check';
      if (tick <= 3) return 'Query Architect';
      if (tick <= 5) return 'Hybrid Retrieval';
      return 'Synthesis Engine';
    };

    setCurrentStage('Guardian Check');

    pollingTimerRef.current = setInterval(async () => {
      pollCount++;
      const stage = updateStage(pollCount);
      setCurrentStage(stage);

      try {
        const res: QueryStatusResponse = await client.getQueryStatus(queryId);

        if (res.stage) {
          setCurrentStage(updateStage(pollCount, res.stage));
        }

        if (res.status === 'completed') {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);

          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMsgId) {
                return {
                  ...msg,
                  content: res.response || 'Query completed with no text returned.',
                  sources: res.sources || [],
                  status: 'completed',
                  cacheHit: res.cache_hit,
                };
              }
              return msg;
            })
          );

          setIsProcessing(false);
          setCurrentQueryId(null);
          setCurrentStage(null);
        } else if (res.status === 'failed') {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);

          const errorMsg = res.error || 'Failed to process query. Please try again.';
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMsgId) {
                return {
                  ...msg,
                  content: `❌ **Query Error**: ${errorMsg}`,
                  status: 'failed',
                };
              }
              return msg;
            })
          );

          addToast(errorMsg, 'error');
          setIsProcessing(false);
          setCurrentQueryId(null);
          setCurrentStage(null);
        }
      } catch (err: any) {
        console.error('Error polling query status:', err);
        // Do not fail immediately on network flake, retry up to 15s (15 ticks)
        if (pollCount >= 15) {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          const errorMsg = err.message || 'Network error while checking query status.';
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMsgId) {
                return {
                  ...msg,
                  content: `❌ **Communication Error**: ${errorMsg}`,
                  status: 'failed',
                };
              }
              return msg;
            })
          );
          addToast(errorMsg, 'error');
          setIsProcessing(false);
          setCurrentQueryId(null);
          setCurrentStage(null);
        }
      }
    }, 1000);
  }, [addToast]);

  const submitUserQuery = useCallback(async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;

    if (role === 'guest' && guestQueryCount <= 0) {
      addToast('Guest query limit (20 max) reached. Please login as a researcher for unlimited access.', 'warning');
      return;
    }

    if (role === 'guest') {
      decrementGuestQueryCount();
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      timestamp,
    };

    const assistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp,
      status: 'processing',
      queryId: undefined,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsProcessing(true);
    setCurrentStage('Guardian Check');

    // Build history for backend
    const history = messages
      .filter((m) => m.status !== 'processing' && m.status !== 'failed' && m.id !== 'welcome-msg')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await client.submitQuery({
        query: trimmed,
        user_id: user?.email || 'guest',
        session_id: `session_${Date.now()}`,
        conversation_history: history,
      });

      const queryId = res.query_id;
      setCurrentQueryId(queryId);

      setMessages((prev) =>
        prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, queryId } : msg))
      );

      // Start polling status every 1 second
      pollQueryStatus(queryId, assistantMsgId);
    } catch (err: any) {
      console.error('Failed to submit query:', err);
      const errorMsg = err.message || 'Failed to submit query to backend server.';
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === assistantMsgId) {
            return {
              ...msg,
              content: `❌ **Error**: ${errorMsg}`,
              status: 'failed',
            };
          }
          return msg;
        })
      );
      addToast(errorMsg, 'error');
      setIsProcessing(false);
      setCurrentStage(null);
    }
  }, [role, guestQueryCount, decrementGuestQueryCount, addToast, user, messages, pollQueryStatus]);

  const submitFeedback = useCallback(async (logId: string, rating: 1 | -1, correctionText?: string) => {
    try {
      await client.submitFeedback({
        log_id: logId,
        user_id: user?.email || 'guest',
        rating,
        correction_text: correctionText,
      });
      addToast('Thank you! Your feedback has been recorded.', 'success');
      closeFeedbackModal();
    } catch (err: any) {
      console.error('Failed to submit feedback:', err);
      addToast(`Feedback error: ${err.message || 'Failed to send feedback.'}`, 'error');
      throw err;
    }
  }, [user, addToast, closeFeedbackModal]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        pills,
        fetchPills,
        isProcessing,
        currentQueryId,
        currentStage,
        activeFeedbackMessage,
        openFeedbackModal,
        closeFeedbackModal,
        submitUserQuery,
        submitFeedback,
        clearChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
