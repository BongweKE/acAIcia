import React from 'react';
import { AdminMetricsResponse } from '../../types';
import { MetricCard } from './MetricCard';
import { LatencyBreakdown } from './LatencyBreakdown';
import { EvaluationTable } from './EvaluationTable';
import { RecentFeedbackTable } from './RecentFeedbackTable';
import {
  ShieldCheck,
  Activity,
  Zap,
  Clock,
  ThumbsUp,
  RefreshCw,
  TrendingUp,
  Database,
  Radio,
} from 'lucide-react';

interface AdminDashboardProps {
  metrics: AdminMetricsResponse;
  onRefresh: () => void;
  isRefreshing: boolean;
  isPolling: boolean;
  onTogglePolling: () => void;
  lastUpdated?: Date;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  metrics,
  onRefresh,
  isRefreshing,
  isPolling,
  onTogglePolling,
  lastUpdated,
}) => {
  const satisfactionPct = metrics.user_feedback?.satisfaction_pct ?? 0;
  const upvotes = metrics.user_feedback?.upvotes ?? 0;
  const downvotes = metrics.user_feedback?.downvotes ?? 0;

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-forest-800/30 p-4 border border-forest-700/50 rounded-2xl">
        <div className="flex items-center gap-2 text-xs text-gray-300">
          <Radio className={`w-4 h-4 ${isPolling ? 'text-emerald-400 animate-pulse' : 'text-gray-500'}`} />
          <span>
            Telemetry Status:{' '}
            <strong className={isPolling ? 'text-emerald-400' : 'text-gray-400'}>
              {isPolling ? 'Live Polling Active (10s)' : 'Manual Refresh Mode'}
            </strong>
          </span>
          {lastUpdated && (
            <span className="text-[11px] font-mono text-gray-400 hidden md:inline ml-2">
              (Updated {lastUpdated.toLocaleTimeString()})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePolling}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              isPolling
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                : 'bg-forest-800 border-forest-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            {isPolling ? 'Auto Polling: ON' : 'Auto Polling: OFF'}
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-forest-950 font-bold text-xs rounded-xl shadow-glow transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Metrics'}</span>
          </button>
        </div>
      </div>

      {/* Top 5 Stat Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <MetricCard
          title="Total Queries"
          value={metrics.total_queries.toLocaleString()}
          subtitle="Processed RAG requests"
          icon={<Activity className="w-4 h-4 text-emerald-400" />}
          trend="+12% this week"
          colorVariant="emerald"
        />

        <MetricCard
          title="Cache Hit Rate"
          value={`${metrics.cache_hit_rate_pct}%`}
          subtitle="Embedding & prompt cache"
          icon={<Database className="w-4 h-4 text-teal-400" />}
          trend="Target >40%"
          colorVariant="emerald"
        />

        <MetricCard
          title="P50 Latency"
          value={`${metrics.p50_latency_ms} ms`}
          subtitle="Median response time"
          icon={<Zap className="w-4 h-4 text-blue-400" />}
          trend="Fast retrieval"
          colorVariant="blue"
        />

        <MetricCard
          title="P95 Latency"
          value={`${metrics.p95_latency_ms} ms`}
          subtitle="95th percentile worst latency"
          icon={<Clock className="w-4 h-4 text-purple-400" />}
          trend="Synthesis bottleneck"
          colorVariant="purple"
        />

        <MetricCard
          title="User Satisfaction"
          value={`${satisfactionPct}%`}
          subtitle={`${upvotes} Up / ${downvotes} Down`}
          icon={<ThumbsUp className="w-4 h-4 text-amber-400" />}
          trend="Feedback log score"
          colorVariant="amber"
        />
      </div>

      {/* Stage Latency Breakdown */}
      {metrics.stage_latency_averages && (
        <LatencyBreakdown stageLatencies={metrics.stage_latency_averages} />
      )}

      {/* Live Recent Feedback Table */}
      <RecentFeedbackTable feedbackList={metrics.recent_feedback || []} />

      {/* Evaluation Benchmark Table */}
      <EvaluationTable evaluations={metrics.recent_evaluations || []} />
    </div>
  );
};
