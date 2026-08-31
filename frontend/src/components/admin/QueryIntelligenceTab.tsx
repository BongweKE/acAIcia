import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { AdminMetricsResponse, PopularDocument } from '../../types';
import { getAdminPopularDocuments } from '../../api/client';
import { Search, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

interface Props {
  metrics: AdminMetricsResponse;
}

export const QueryIntelligenceTab: React.FC<Props> = ({ metrics }) => {
  const [popularDocs, setPopularDocs] = useState<PopularDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getAdminPopularDocuments(10).then(res => {
      if(active) { setPopularDocs(res.documents); setLoading(false); }
    }).catch(e => {
      console.error(e);
      if(active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const topics = Object.entries(metrics.topic_distribution || {}).sort((a,b) => b[1] - a[1]);
  
  const topicData = {
    labels: topics.map(t => t[0].replace('_', ' ').toUpperCase()),
    datasets: [{
      label: 'Queries',
      data: topics.map(t => t[1]),
      backgroundColor: topics.map((_, i) => `hsl(${150 + i * 20}, 70%, 50%)`),
      borderRadius: 4
    }]
  };

  const topicOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
      y: { grid: { display: false }, ticks: { color: '#e5e7eb', font: { size: 10 } } }
    }
  };

  const qTypeData = {
    labels: Object.keys(metrics.query_type_distribution || {}),
    datasets: [{
      data: Object.values(metrics.query_type_distribution || {}),
      backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'],
      borderWidth: 0
    }]
  };

  return (
    <div className="space-y-6">
      {metrics.fallback_rate_pct > 15 && (
        <div className="bg-red-900/40 border border-red-700/60 rounded-xl p-4 flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-red-400 font-semibold text-sm">High Fallback Rate Detected</h4>
            <p className="text-red-200/80 text-xs mt-1">
              {metrics.fallback_rate_pct}% of queries are falling back to general knowledge. Review the topics with the lowest matches and consider ingesting more specialized documents for those areas.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl p-5 h-[350px]">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Topic Distribution</h3>
          <div className="h-[280px]">
             {topics.length > 0 ? <Bar data={topicData} options={topicOptions} /> : <div className="text-gray-500 text-center py-20">No topic data</div>}
          </div>
        </div>

        <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl p-5 h-[350px] flex flex-col">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Query Type Breakdown</h3>
          <div className="flex-1 flex justify-center pb-4">
             {Object.keys(metrics.query_type_distribution || {}).length > 0 ? 
                <Doughnut data={qTypeData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#d1d5db', padding: 20 } } } }} />
             : <div className="text-gray-500 text-center py-20">No query type data</div>}
          </div>
        </div>
      </div>

      <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-forest-700/60 bg-forest-900/50 flex items-center gap-2">
          <Search className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-gray-200">Most Retrieved Documents</h3>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 flex justify-center text-emerald-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="text-xs uppercase bg-forest-900/50 text-gray-400 border-b border-forest-700/60">
                <tr>
                  <th className="px-4 py-3">Document Title</th>
                  <th className="px-4 py-3 text-center">RRF Score</th>
                  <th className="px-4 py-3 text-center">Hits</th>
                  <th className="px-4 py-3">Last Retrieved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest-700/40">
                {popularDocs.map((doc, i) => (
                  <tr key={i} className="hover:bg-forest-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-200 line-clamp-2">{doc.title}</p>
                      {doc.doi && (
                        <a href={`https://doi.org/${doc.doi}`} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:underline flex items-center gap-1 mt-1 w-fit">
                          {doc.doi} <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-emerald-400">{doc.avg_rrf_score.toFixed(3)}</td>
                    <td className="px-4 py-3 text-center">{doc.query_count}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{doc.last_retrieved_at ? new Date(doc.last_retrieved_at).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
                {popularDocs.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No popular documents data</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
