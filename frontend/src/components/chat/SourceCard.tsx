import React, { useState } from 'react';
import { SourceChunk } from '../../types';
import { ExternalLink, BookOpen, ChevronDown, ChevronUp, FileText } from 'lucide-react';

interface SourceCardProps {
  source: SourceChunk;
  index?: number;
}

export const SourceCard: React.FC<SourceCardProps> = ({ source, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const doiUrl = source.doi
    ? source.doi.startsWith('http')
      ? source.doi
      : `https://doi.org/${source.doi}`
    : source.url || '#';

  return (
    <div className="bg-forest-800/60 border border-forest-700/60 hover:border-emerald-500/40 rounded-xl p-3.5 transition-all shadow-sm hover:shadow-glow space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 shrink-0 mt-0.5">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-gray-100 leading-snug line-clamp-2">
              {source.title}
            </h4>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
              <span className="truncate max-w-[200px]">{source.authors}</span>
              <span>•</span>
              <span className="font-mono text-emerald-300 font-medium">{source.year}</span>
            </div>
          </div>
        </div>

        {source.doi || source.url ? (
          <a
            href={doiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 bg-forest-700/60 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-forest-600/40 hover:border-emerald-500/40 transition-colors shrink-0 flex items-center gap-1 text-[11px]"
            title="View full publication via DOI"
          >
            <span className="hidden sm:inline font-mono">DOI</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : null}
      </div>

      {/* Snippet Preview */}
      {source.snippet && (
        <div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium transition-colors pt-1"
          >
            <FileText className="w-3 h-3" />
            <span>{isExpanded ? 'Hide Chunk Preview' : 'Show Chunk Preview'}</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          
          {isExpanded && (
            <div className="mt-2 p-2.5 bg-forest-900/80 rounded-lg border border-forest-700/50 text-xs text-gray-300 font-mono leading-relaxed max-h-40 overflow-y-auto">
              "{source.snippet}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
