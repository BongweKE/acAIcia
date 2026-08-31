import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { AdminMetricsResponse } from '../../types';
import { getAdminCacheStats, clearSemanticCache } from '../../api/client';
import { Database, Zap, Trash2, Clock } from 'lucide-react';
import { LatencyBreakdown } from './LatencyBreakdown'; // Reuse existing

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface Props {
  metrics: AdminMetricsResponse;
}

export const PerformanceTab: React.FC<Props> = ({ metrics }) => {
  const [cacheStats, setCacheStats] = useState<any>(null);

  useEffect(() => {
    getAdminCacheStats().then(setCacheStats).catch(console.error);
  }, []);

  const handleClearCache = async () => {
    if (confirm('Are you sure you want to clear the semantic cache? This will temporarily increase query latency.')) {
      try {
        await clearSemanticCache();
        const stats = await getAdminCacheStats();
        setCacheStats(stats);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const lineData = {
    labels: metrics.timeseries?.map(t => t.day) || [],
    datasets: [{
      label: 'Avg Latency (ms)',
      data: metrics.timeseries?.map(t => t.avg_latency_ms) || [],
      borderColor: '#f59e0b',
      backgroundColor: 'transparent',
      tension: 0.3,
    }]
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } }
    }
  };

  // Process Heatmap Data
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxQueries = Math.max(...(metrics.hourly_heatmap?.map(h => h.query_count) || [0]), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-gray-400 mb-1">P50 Latency</p>
          <p className="text-3xl font-bold text-emerald-400">{metrics.p50_latency_ms} <span className="text-lg text-emerald-400/60">ms</span></p>
        </div>
        <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-gray-400 mb-1">P95 Latency</p>
          <p className="text-3xl font-bold text-amber-400">{metrics.p95_latency_ms} <span className="text-lg text-amber-400/60">ms</span></p>
        </div>
        <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-gray-400 mb-1">P99 Latency</p>
          <p className="text-3xl font-bold text-red-400">{metrics.p99_latency_ms} <span className="text-lg text-red-400/60">ms</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl p-5 h-[350px] flex flex-col">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Latency Trend</h3>
          <div className="flex-1 min-h-0">
             <Line data={lineData} options={lineOptions} />
          </div>
        </div>
        
        <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl p-5">
           <h3 className="text-sm font-semibold text-gray-300 mb-4">Stage Breakdown</h3>
           <LatencyBreakdown stageLatencies={metrics.stage_latency_averages} />
        </div>
      </div>

      <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl p-5 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-semibold text-gray-200">Time-of-Day Heatmap (UTC)</h3>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="flex ml-12 mb-1">
              {Array.from({length: 24}).map((_, i) => (
                <div key={i} className="flex-1 text-center text-[10px] text-gray-500">{i}</div>
              ))}
            </div>
            {days.map((day, dIdx) => (
              <div key={day} className="flex items-center mb-1">
                <div className="w-12 text-xs text-gray-400 text-right pr-2">{day}</div>
                <div className="flex flex-1 gap-1">
                  {Array.from({length: 24}).map((_, h) => {
                    const cell = metrics.hourly_heatmap?.find(m => m.day_of_week === dIdx && m.hour_utc === h);
                    const count = cell ? cell.query_count : 0;
                    const intensity = count > 0 ? 0.2 + (count / maxQueries) * 0.8 : 0.05;
                    return (
                      <div 
                        key={h} 
                        className="flex-1 h-8 rounded-sm group relative"
                        style={{ backgroundColor: `rgba(16, 185, 129, ${intensity})` }}
                      >
                        {count > 0 && (
                          <div className="absolute opacity-0 group-hover:opacity-100 bg-forest-950 border border-forest-700 text-xs text-gray-200 p-2 rounded shadow-lg z-10 bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap pointer-events-none">
                            {count} queries<br/>
                            Avg: {cell?.avg_latency_ms}ms
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 rounded-xl">
            <Database className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-200">Semantic Cache</h3>
            <p className="text-xs text-gray-400 mt-1">
              {cacheStats ? `${cacheStats.total_entries} entries • Size: ${(cacheStats.size_bytes / 1024 / 1024).toFixed(2)} MB` : 'Loading stats...'}
            </p>
          </div>
        </div>
        <button 
          onClick={handleClearCache}
          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" /> Clear Cache
        </button>
      </div>
    </div>
  );
};
