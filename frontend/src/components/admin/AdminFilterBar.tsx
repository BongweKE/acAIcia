import React, { useState } from 'react';
import { Filter, RotateCcw, Clock } from 'lucide-react';
import { AdminFilters } from '../../types';

const TOPICS = [
  { id: '', label: 'All Topics' },
  { id: 'peatlands', label: '🌊 Peatland Hydrology' },
  { id: 'fire_management', label: '🔥 Fire & Smoke' },
  { id: 'food_systems', label: '🌾 Food Systems' },
  { id: 'agroforestry', label: '🌳 Agroforestry' },
  { id: 'climate_change', label: '🌡️ Climate Change' },
  { id: 'soil_science', label: '🪱 Soil Science' },
  { id: 'biodiversity', label: '🦋 Biodiversity' },
  { id: 'policy', label: '📜 Policy' },
  { id: 'methodology', label: '🔬 Methodology' },
  { id: 'general', label: '💬 General' },
];

const PROVIDERS = [
  { id: '', label: 'All Providers' },
  { id: 'gemini', label: 'Google Gemini' },
  { id: 'nvidia', label: 'NVIDIA Llama' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'modal', label: 'Modal Gemma' },
];

const QUERY_TYPES = [
  { id: '', label: 'All Types' },
  { id: 'database_match', label: 'Database Match' },
  { id: 'general_knowledge_fallback', label: 'Fallback (No Match)' },
  { id: 'semantic_cache', label: 'Cache Hit' },
];

interface Props {
  filters: AdminFilters;
  onApply: (f: AdminFilters) => void;
}

export const AdminFilterBar: React.FC<Props> = ({ filters, onApply }) => {
  const [local, setLocal] = useState<AdminFilters>(filters);

  const getDateRange = (range: AdminFilters['dateRange']) => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const end = fmt(today);
    const days: Record<string, number> = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 };
    const start = fmt(new Date(today.getTime() - (days[range] || 30) * 86400000));
    return { startDate: start, endDate: end };
  };

  const setRange = (range: AdminFilters['dateRange']) => {
    if (range === 'custom') {
      setLocal(prev => ({ ...prev, dateRange: 'custom' }));
    } else {
      const { startDate, endDate } = getDateRange(range);
      setLocal(prev => ({ ...prev, dateRange: range, startDate, endDate }));
    }
  };

  const reset = () => {
    const reset: AdminFilters = { dateRange: '30d', ...getDateRange('30d') };
    setLocal(reset);
    onApply(reset);
  };

  const apply = () => onApply(local);

  const rangeBtn = (range: AdminFilters['dateRange'], label: string) => (
    <button
      key={range}
      onClick={() => setRange(range)}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
        local.dateRange === range
          ? 'bg-emerald-500 text-forest-950 border-emerald-400 shadow-glow'
          : 'bg-forest-900 text-gray-400 border-forest-700 hover:border-emerald-600 hover:text-gray-200'
      }`}
    >
      {label}
    </button>
  );

  const select = (field: keyof AdminFilters, opts: { id: string; label: string }[]) => (
    <select
      value={(local[field] as string) || ''}
      onChange={e => setLocal(prev => ({ ...prev, [field]: e.target.value || undefined }))}
      className="bg-forest-900 border border-forest-700 text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:border-emerald-500 focus:outline-none"
    >
      {opts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );

  return (
    <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Filters</span>
        <div className="flex gap-1.5 flex-wrap">
          {(['1d', '7d', '30d', '90d'] as AdminFilters['dateRange'][]).map(r =>
            rangeBtn(r, r === '1d' ? 'Today' : r)
          )}
          {rangeBtn('custom', 'Custom')}
        </div>
      </div>

      {local.dateRange === 'custom' && (
        <div className="flex gap-2 items-center">
          <span className="text-xs text-gray-400">From</span>
          <input type="date" value={local.startDate || ''}
            onChange={e => setLocal(prev => ({ ...prev, startDate: e.target.value }))}
            className="bg-forest-900 border border-forest-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:border-emerald-500 focus:outline-none" />
          <span className="text-xs text-gray-400">To</span>
          <input type="date" value={local.endDate || ''}
            onChange={e => setLocal(prev => ({ ...prev, endDate: e.target.value }))}
            className="bg-forest-900 border border-forest-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:border-emerald-500 focus:outline-none" />
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {select('topic', TOPICS)}
        {select('provider', PROVIDERS)}
        {select('queryType', QUERY_TYPES)}
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-400">Hour</span>
          <input type="number" min={0} max={23} placeholder="0"
            value={local.hourStart ?? ''}
            onChange={e => setLocal(prev => ({ ...prev, hourStart: e.target.value ? Number(e.target.value) : undefined }))}
            className="w-14 bg-forest-900 border border-forest-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:border-emerald-500 focus:outline-none" />
          <span className="text-xs text-gray-400">–</span>
          <input type="number" min={0} max={23} placeholder="23"
            value={local.hourEnd ?? ''}
            onChange={e => setLocal(prev => ({ ...prev, hourEnd: e.target.value ? Number(e.target.value) : undefined }))}
            className="w-14 bg-forest-900 border border-forest-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:border-emerald-500 focus:outline-none" />
        </div>
        <button onClick={apply}
          className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-forest-950 font-bold text-xs rounded-lg shadow-glow transition-all">
          Apply
        </button>
        <button onClick={reset} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors">
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>
    </div>
  );
};
