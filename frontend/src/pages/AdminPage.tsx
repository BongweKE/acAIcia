import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AdminMetricsResponse } from '../types';
import * as client from '../api/client';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { ShieldCheck, AlertTriangle, LogIn } from 'lucide-react';

export const AdminPage: React.FC = () => {
  const { role, openLoginModal } = useAuth();
  const [metrics, setMetrics] = useState<AdminMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>(undefined);

  const fetchMetrics = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      else setIsRefreshing(true);

      const data = await client.getAdminMetrics();
      setMetrics(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.warn('Admin metrics fetch error:', err);
      setError(err.message || 'Failed to fetch admin metrics telemetry.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (role === 'admin') {
      fetchMetrics(false);
    }
  }, [role, fetchMetrics]);

  // Polling interval (every 10 seconds if polling active)
  useEffect(() => {
    if (role !== 'admin' || !isPolling) return;

    const timer = setInterval(() => {
      fetchMetrics(true);
    }, 10000);

    return () => clearInterval(timer);
  }, [role, isPolling, fetchMetrics]);

  // Restricted Access Banner for Non-Admin
  if (role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-rose-950/30 border border-rose-500/30 rounded-2xl shadow-2xl text-center space-y-4">
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl w-fit mx-auto">
          <AlertTriangle className="w-8 h-8 text-rose-400" />
        </div>
        <h3 className="text-xl font-bold text-rose-200 font-sans">Admin Access Restricted</h3>
        <p className="text-xs text-gray-300 leading-relaxed">
          The Admin Observability Dashboard requires Administrator credentials.
          Please log in with an authorized Administrator account.
        </p>
        <div className="pt-2">
          <button
            onClick={openLoginModal}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-forest-950 font-bold text-xs rounded-xl shadow-glow transition-all inline-flex items-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            <span>Login as Admin</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full p-4 sm:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-forest-800">
        <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/30 shadow-glow">
          <ShieldCheck className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white font-sans">Admin Observability Dashboard</h1>
          <p className="text-xs text-gray-400">
            Real-time RAG pipeline telemetry, stage latencies, and automated evaluation benchmark scores
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-emerald-400 font-mono text-sm animate-pulse space-y-3 bg-forest-800/30 rounded-2xl border border-forest-700/50">
          <ShieldCheck className="w-8 h-8 mx-auto animate-bounce opacity-80" />
          <div>Connecting to telemetry endpoint GET /admin/metrics...</div>
        </div>
      ) : error ? (
        <div className="p-6 bg-forest-800/40 border border-amber-500/40 rounded-2xl text-amber-300 text-xs space-y-2">
          <div className="font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Telemetry Fetch Notice</span>
          </div>
          <p>{error}</p>
          <button
            onClick={() => fetchMetrics(false)}
            className="mt-2 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-lg text-xs font-medium border border-amber-500/40 transition-colors"
          >
            Retry Fetching Telemetry
          </button>
        </div>
      ) : metrics ? (
        <AdminDashboard
          metrics={metrics}
          onRefresh={() => fetchMetrics(true)}
          isRefreshing={isRefreshing}
          isPolling={isPolling}
          onTogglePolling={() => setIsPolling((prev) => !prev)}
          lastUpdated={lastUpdated}
        />
      ) : null}
    </div>
  );
};
