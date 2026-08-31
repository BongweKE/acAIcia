import React, { useState, useEffect, useCallback } from 'react';
import { AdminMetricsResponse, AdminFilters, LLMProvider } from '../types';
import * as client from '../api/client';
import { ShieldCheck, AlertTriangle, Key, RefreshCw, Download, Cpu, Check } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'cost' | 'intelligence' | 'performance' | 'evaluations'>('overview');
  
  const [filters, setFilters] = useState<AdminFilters>({
    dateRange: '30d',
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [adminKey, setAdminKey] = useState(localStorage.getItem('acaicia_admin_key') || '');
  const [keySaved, setKeySaved] = useState(false);
  const [isUpdatingModel, setIsUpdatingModel] = useState(false);

  const saveAdminKey = () => {
    localStorage.setItem('acaicia_admin_key', adminKey);
    setKeySaved(true);
    addToast('Admin API Key saved to local storage.', 'success');
    setTimeout(() => setKeySaved(false), 2000);
    fetchMetrics(filters);
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

  useEffect(() => {
    fetchMetrics(filters);
  }, [fetchMetrics]);

  const handleApplyFilters = (newFilters: AdminFilters) => {
    setFilters(newFilters);
    fetchMetrics(newFilters);
  };

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
        </div>
      </div>

      {/* Admin API Key & Model Control Panel */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Admin API Key Auth Input */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-accent uppercase tracking-wider">
            <Key className="w-4 h-4" /> Admin API Authentication Key
          </div>
          <p className="text-xs text-muted-foreground">
            Provide the Bearer token configured in Modal secrets (<code className="font-mono text-[11px] text-foreground">ADMIN_API_KEY</code>).
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="Enter Admin API Key..."
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="flex-1 bg-background border border-input text-foreground text-xs rounded-lg px-3 py-2 focus:border-accent focus:outline-none"
            />
            <button
              onClick={saveAdminKey}
              className="px-4 py-2 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-xs rounded-lg transition-colors shadow-sm"
            >
              {keySaved ? 'Saved!' : 'Save Key'}
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
          <div className="grid grid-cols-2 gap-2">
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
