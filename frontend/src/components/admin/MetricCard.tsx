import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: string;
  colorVariant?: 'emerald' | 'purple' | 'blue' | 'amber' | 'rose';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  colorVariant = 'emerald',
}) => {
  const colorMap = {
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
    purple: 'text-purple-400 border-purple-500/20 bg-purple-500/10',
    blue: 'text-blue-400 border-blue-500/20 bg-blue-500/10',
    amber: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
    rose: 'text-rose-400 border-rose-500/20 bg-rose-500/10',
  };

  const valueColorMap = {
    emerald: 'text-emerald-400',
    purple: 'text-purple-300',
    blue: 'text-blue-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
  };

  return (
    <div className="p-4 bg-forest-800/40 border border-forest-700/60 rounded-2xl shadow-md hover:border-forest-600 transition-all flex flex-col justify-between space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</span>
        {icon && (
          <div className={`p-2 rounded-xl border ${colorMap[colorVariant]}`}>
            {icon}
          </div>
        )}
      </div>

      <div>
        <div className={`text-2xl font-bold font-mono tracking-tight ${valueColorMap[colorVariant]}`}>
          {value}
        </div>
        {subtitle && <div className="text-[11px] text-gray-400 mt-1">{subtitle}</div>}
      </div>

      {trend && (
        <div className="text-[10px] font-mono text-gray-400 border-t border-forest-800 pt-1.5 flex items-center justify-between">
          <span>Telemetry Trend</span>
          <span className="text-emerald-400 font-semibold">{trend}</span>
        </div>
      )}
    </div>
  );
};
