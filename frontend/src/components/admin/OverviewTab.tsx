import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { AdminMetricsResponse } from '../../types';
import { MetricCard } from './MetricCard'; // Assume existing

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Props {
  metrics: AdminMetricsResponse;
}

export const OverviewTab: React.FC<Props> = ({ metrics }) => {
  const lineData = {
    labels: metrics.timeseries?.map(t => t.day) || [],
    datasets: [
      {
        label: 'Total Queries',
        data: metrics.timeseries?.map(t => t.total_queries) || [],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Cache Hits',
        data: metrics.timeseries?.map(t => t.cache_hits) || [],
        borderColor: '#3b82f6',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.4,
      }
    ]
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#d1d5db' } },
      tooltip: { mode: 'index' as const, intersect: false }
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } }
    }
  };

  const provLabels = Object.keys(metrics.cost_by_provider || {});
  const provData = Object.values(metrics.cost_by_provider || {});
  
  const doughnutData = {
    labels: provLabels,
    datasets: [{
      data: provData,
      backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'],
      borderWidth: 0,
    }]
  };

  const formatCurrency = (val: number) => `$${val.toFixed(val < 1 ? 4 : 2)}`;

  return (
    <div className="space-y-6">
      {metrics.fallback_rate_pct > 15 && (
        <div className="bg-amber-900/40 border border-amber-700/60 rounded-xl p-4 flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-amber-400 font-semibold text-sm">High Fallback Rate ({metrics.fallback_rate_pct}%)</h4>
            <p className="text-amber-200/80 text-xs mt-1">
              A large number of queries are not matching the internal document database. Consider reviewing these queries and ingesting more relevant literature.
            </p>
          </div>
        </div>
      )}

      {metrics.system_alerts && metrics.system_alerts.filter(a => !a.resolved).length > 0 && (
        <div className="bg-red-900/40 border border-red-700/60 rounded-xl p-4 flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-red-400 font-semibold text-sm">System Alerts</h4>
            <ul className="text-red-200/80 text-xs mt-1 list-disc pl-4 space-y-1">
              {metrics.system_alerts.filter(a => !a.resolved).map(a => (
                <li key={a.alert_id}>{a.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard title="Total Queries" value={metrics.total_queries} />
        <MetricCard title="Unique Users" value={metrics.unique_users} />
        <MetricCard title="Cache Hit %" value={`${metrics.cache_hit_rate_pct.toFixed(1)}%`} />
        <MetricCard title="Guardian Pass %" value={`${metrics.guardian_pass_rate_pct.toFixed(1)}%`} />
        <MetricCard title="Est. Total Cost" value={formatCurrency(metrics.estimated_total_cost_usd)} />
        <MetricCard title="Avg Latency (P50)" value={`${metrics.p50_latency_ms}ms`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-forest-800/40 border border-forest-700/60 rounded-2xl p-5 h-[350px]">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Daily Query Volume</h3>
          <div className="h-[280px]">
            <Line data={lineData} options={lineOptions} />
          </div>
        </div>
        <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl p-5 h-[350px] flex flex-col items-center">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 w-full text-left">Cost by Provider</h3>
          {provData.length > 0 ? (
             <div className="w-full max-w-[200px] flex-1">
               <Doughnut data={doughnutData} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#d1d5db' } } }, maintainAspectRatio: false }} />
             </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <Info className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-xs">No cost data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
