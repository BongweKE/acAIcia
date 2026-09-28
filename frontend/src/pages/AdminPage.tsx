import React, { useState, useEffect, useCallback } from 'react';
import { AdminMetricsResponse, AdminFilters, LLMProvider } from '../types';
import * as client from '../api/client';
import { ShieldCheck, AlertTriangle, Key, RefreshCw, Download, Cpu, Check, Lock } from 'lucide-react';
import { AdminFilterBar } from '../components/admin/AdminFilterBar';
import { OverviewTab } from '../components/admin/OverviewTab';
import { CostUsageTab } from '../components/admin/CostUsageTab';
import { QueryIntelligenceTab } from '../components/admin/QueryIntelligenceTab';
import { PerformanceTab } from '../components/admin/PerformanceTab';
import { EvaluationsTab } from '../components/admin/EvaluationsTab';
import { useSettings, PROVIDER_OPTIONS } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';

export const AdminPage: React.FC = () => {
  const { addToast } = useToast();
  const { activeProvider, setProvider } = useSettings();

  const [metrics, setMetrics] = useState<AdminMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'cost' | 'intelligence' | 'performance' | 'evaluations'>('overview');

  const [filters, setFilters] = useState<AdminFilters>({
    dateRange: '30d',
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [adminKey, setAdminKey] = useState(localStorage.getItem('acaicia_admin_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isUpdatingModel, setIsUpdatingModel] = useState(false);

  const fetchMetrics = useCallback(async (currentFilters: AdminFilters) => {
    try {
      setIsLoading(true);
      const data = await client.getAdminMetrics({
        start_date: currentFilters.startDate,
        end_date: currentFilters.endDate,
        topic: currentFilters.topic,
        provider: currentFilters.provider,
        query_type: currentFilters.queryType,
        hour_start: currentFilters.hourStart,
        hour_end: currentFilters.hourEnd,
      });
      setMetrics(data);
      setError(null);
    } catch (err: any) {
      console.warn('Admin metrics fetch error:', err);
      setError(err.message || 'Failed to fetch admin metrics telemetry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unlockWithKey = useCallback(async (key: string) => {
    setIsVerifying(true);
    setAuthError(null);
    try {
      const ok = await client.verifyAdminKey(key);
      if (ok) {
        localStorage.setItem('acaicia_admin_key', key);
        setIsAuthenticated(true);
        addToast('Admin access granted.', 'success');
      } else {
        localStorage.removeItem('acaicia_admin_key');
        setIsAuthenticated(false);
        setMetrics(null);
        setAuthError('Invalid admin key. Access denied.');
      }
    } finally {
      setIsVerifying(false);
    }
  }, [addToast]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminKey.trim()) {
      setAuthError('Please enter the admin key.');
      return;
    }
    unlockWithKey(adminKey.trim());
  };

  const lock = () => {
    localStorage.removeItem('acaicia_admin_key');
    setIsAuthenticated(false);
    setMetrics(null);
    setAdminKey('');
    setAuthError(null);
    addToast('Admin session locked.', 'success');
  };

  // Verify any stored key once on mount before rendering the dashboard.
  useEffect(() => {
    const stored = localStorage.getItem('acaicia_admin_key') || '';
    if (stored) {
      unlockWithKey(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMetrics(filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleApplyFilters = (newFilters: AdminFilters) => {
    setFilters(newFilters);
    fetchMetrics(newFilters);
  };

  const handleModelChange = async (providerId: LLMProvider) => {
    try {
      setIsUpdatingModel(true);
      await setProvider(providerId);
      addToast(`Active system model updated to ${providerId}.`, 'success');
    } catch (err: any) {
      addToast(`Failed to update model: ${err.message}`, 'error');
    } finally {
      setIsUpdatingModel(false);
    }
  };

  // ── Access gate: no admin content is rendered until the key is verified ──
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-6 py-24">
        <form onSubmit={handleUnlock} className="rounded-2xl border border-border bg-card p-8 shadow-sm space-y-5">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="p-3 bg-accent/10 rounded-2xl border border-accent/30 text-accent">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-serif font-medium tracking-tight">Admin Access Required</h1>
            <p className="text-xs text-muted-foreground">
              Enter the admin API key to access the observability dashboard.
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-accent uppercase tracking-wider">
              <Key className="w-4 h-4" /> Admin API Key
            </label>
            <input
              type="password"
              autoFocus
              placeholder="Enter Admin API Key..."
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="w-full bg-background border border-input text-foreground text-sm rounded-lg px-3 py-2.5 focus:border-accent focus:outline-none"
            />
          </div>

          {authError && (
            <div className="flex items-center gap-2 text-destructive text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full px-4 py-2.5 bg-accent hover:bg-accent/90 disabled:opacity-60 text-accent-foreground font-semibold text-sm rounded-lg transition-colors shadow-sm"
          >
            {isVerifying ? 'Verifying…' : 'Unlock Dashboard'}
          </button>
        </form>
      </div>
    );
  }

  const exportUrl = client.getExportCsvUrl(filters.startDate, filters.endDate);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 space-y-8">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-accent/10 rounded-2xl border border-accent/30 text-accent">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-medium tracking-tight">Admin Observability Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-1">Platform metrics, telemetry, and system model governance</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={exportUrl}
            download
            className="px-3.5 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-4 h-4 text-accent" /> Export CSV
          </a>
          <button
            onClick={() => fetchMetrics(filters)}
            className="px-3.5 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={lock}
            className="px-3.5 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
            title="Lock admin session"
          >
            <Lock className="w-4 h-4 text-accent" /> Lock
          </button>
        </div>
      </div>

      {/* Global LLM Governance Control */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-accent uppercase tracking-wider">
          <Cpu className="w-4 h-4" /> Global Model Selection (Admin Only)
        </div>
        <p className="text-xs text-muted-foreground">
          Select the active LLM provider for all user synthesis queries across acAIcia.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PROVIDER_OPTIONS.map((opt) => {
            const isSelected = activeProvider === opt.id || activeProvider.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                disabled={isUpdatingModel}
                onClick={() => handleModelChange(opt.id)}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent/10 font-semibold text-accent'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                <span className="truncate">{opt.name}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-accent" />}
              </button>
            );
          })}
        </div>
      </div>

      <AdminFilterBar filters={filters} onApply={handleApplyFilters} />

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-card rounded-xl border border-border w-fit shadow-sm overflow-x-auto">
        {[
          { id: 'overview', label: '📊 Overview' },
          { id: 'cost', label: '💰 Cost & Usage' },
          { id: 'intelligence', label: '🧠 Query Intelligence' },
          { id: 'performance', label: '⚡ Performance' },
          { id: 'evaluations', label: '📋 Evaluations' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-accent text-accent-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && !metrics ? (
        <div className="p-16 text-center text-accent font-mono text-xs animate-pulse space-y-3 bg-card rounded-2xl border border-border">
          <ShieldCheck className="w-8 h-8 mx-auto opacity-80" />
          <div>Loading admin analytics telemetry...</div>
        </div>
      ) : error ? (
        <div className="p-6 bg-card border border-destructive/40 rounded-2xl text-destructive text-xs space-y-2">
          <div className="font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Telemetry Notice</span>
          </div>
          <p>{error}</p>
        </div>
      ) : metrics ? (
        <div className="animate-in fade-in duration-300">
          {activeTab === 'overview' && <OverviewTab metrics={metrics} />}
          {activeTab === 'cost' && <CostUsageTab metrics={metrics} />}
          {activeTab === 'intelligence' && <QueryIntelligenceTab metrics={metrics} />}
          {activeTab === 'performance' && <PerformanceTab metrics={metrics} />}
          {activeTab === 'evaluations' && <EvaluationsTab metrics={metrics} />}
        </div>
      ) : null}
    </div>
  );
};
