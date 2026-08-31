import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { AdminMetricsResponse, UserCostEntry } from '../../types';
import { getAdminUsers } from '../../api/client';
import { DollarSign, Cpu, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Props {
  metrics: AdminMetricsResponse;
}

export const CostUsageTab: React.FC<Props> = ({ metrics }) => {
  const [users, setUsers] = useState<UserCostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await getAdminUsers({ page, limit: 25, start_date: metrics.filter_state.start_date, end_date: metrics.filter_state.end_date });
        if (active) {
          setUsers(res.users);
          setTotal(res.total);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchUsers();
    return () => { active = false; };
  }, [page, metrics.filter_state]);

  const barData = {
    labels: metrics.timeseries?.map(t => t.day) || [],
    datasets: [{
      label: 'Estimated Cost ($)',
      data: metrics.timeseries?.map(t => t.estimated_cost_usd) || [],
      backgroundColor: '#10b981',
      borderRadius: 4
    }]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', callback: (val: any) => `$${val}` } }
    }
  };

  const formatCost = (val: number) => `$${val.toFixed(val < 1 ? 4 : 2)}`;

  const getCostColor = (cost: number) => {
    if (cost > 1.0) return 'text-red-400';
    if (cost >= 0.1) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const avgTokens = metrics.total_queries ? Math.round(metrics.total_tokens_used / metrics.total_queries) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1 bg-forest-800/40 border border-forest-700/60 rounded-2xl p-5 flex flex-col justify-center">
          <h3 className="text-sm text-gray-400 mb-1 flex items-center gap-1.5"><DollarSign className="w-4 h-4"/> Estimated Cost</h3>
          <p className="text-4xl font-bold text-emerald-400">{formatCost(metrics.estimated_total_cost_usd)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(metrics.cost_by_provider || {}).map(([prov, cost]) => (
              <span key={prov} className="px-2 py-1 bg-forest-900 border border-forest-700 rounded-full text-xs text-gray-300">
                {prov}: <span className="text-emerald-400 font-semibold">{formatCost(cost)}</span>
              </span>
            ))}
          </div>
        </div>
        
        <div className="md:col-span-3 bg-forest-800/40 border border-forest-700/60 rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Total Tokens</p>
            <p className="text-xl font-bold text-gray-200">{metrics.total_tokens_used.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Input Tokens</p>
            <p className="text-xl font-bold text-gray-200">{metrics.total_input_tokens.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Output Tokens</p>
            <p className="text-xl font-bold text-gray-200">{metrics.total_output_tokens.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Cpu className="w-3 h-3"/> Avg / Query</p>
            <p className="text-xl font-bold text-gray-200">{avgTokens.toLocaleString()}</p>
          </div>
          <div className="col-span-full h-[180px] mt-2">
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
      </div>

      <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-forest-700/60 flex justify-between items-center bg-forest-900/50">
          <h3 className="text-sm font-semibold text-gray-200">User Cost & Usage</h3>
          <div className="flex gap-2 items-center text-xs text-gray-400">
            <span>Page {page}</span>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 hover:bg-forest-700 rounded disabled:opacity-50"><ChevronLeft className="w-4 h-4"/></button>
            <button onClick={() => setPage(p => p + 1)} disabled={users.length < 25} className="p-1 hover:bg-forest-700 rounded disabled:opacity-50"><ChevronRight className="w-4 h-4"/></button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 flex justify-center text-emerald-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="text-xs uppercase bg-forest-900/50 text-gray-400 border-b border-forest-700/60">
                <tr>
                  <th className="px-4 py-3">User / Email</th>
                  <th className="px-4 py-3">Queries</th>
                  <th className="px-4 py-3">Cache Hits</th>
                  <th className="px-4 py-3">Tokens</th>
                  <th className="px-4 py-3">Est. Cost ($)</th>
                  <th className="px-4 py-3">Top Topic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest-700/40">
                {users.map((u, i) => (
                  <tr key={i} className="hover:bg-forest-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-200">{u.email || u.user_key}</td>
                    <td className="px-4 py-3">{u.total_queries}</td>
                    <td className="px-4 py-3">{u.cache_hits}</td>
                    <td className="px-4 py-3">{u.total_tokens.toLocaleString()}</td>
                    <td className={`px-4 py-3 font-semibold ${getCostColor(u.estimated_cost_usd)}`}>{formatCost(u.estimated_cost_usd)}</td>
                    <td className="px-4 py-3 text-xs capitalize">{u.top_topic?.replace('_', ' ') || '-'}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No user data found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
