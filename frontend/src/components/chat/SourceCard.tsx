import React, { useState } from 'react';
import { SourceChunk } from '../../types';
import { ExternalLink, BookOpen, ChevronDown, ChevronUp, FileText, Check, Library } from 'lucide-react';

interface SourceCardProps {
  source: SourceChunk;
  index?: number;
}

export const SourceCard: React.FC<SourceCardProps> = ({ source }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const doiUrl = source.doi
    ? source.doi.startsWith('http')
      ? source.doi
      : `https://doi.org/${source.doi}`
    : source.url || '#';

  return (
    <div className="bg-card border border-border hover:border-accent/40 rounded-xl p-3.5 transition-all shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="p-1.5 bg-accent/10 rounded-lg shrink-0 mt-0.5 text-accent">
            <BookOpen className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-foreground leading-snug line-clamp-2">
              {source.title}
            </h4>
            <div className="flex items-center gap-2 mt-1 mb-1 text-[11px] text-muted-foreground">
              <span className="truncate max-w-[200px]">{source.authors}</span>
              <span>•</span>
              <span className="font-mono text-accent font-medium">{source.year}</span>
            </div>
            
            {source.cited !== undefined && (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold mt-1 ${
                source.cited
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'bg-muted text-muted-foreground border border-border'
              }`}>
                {source.cited ? (
                  <><Check className="w-2.5 h-2.5" /> Cited</>
                ) : (
                  <><Library className="w-2.5 h-2.5" /> Retrieved</>
                )}
              </span>
            )}
          </div>
        </div>

        {source.doi || source.url ? (
          <a
            href={doiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 bg-muted hover:bg-accent/10 text-accent rounded-lg border border-border hover:border-accent/40 transition-colors shrink-0 flex items-center gap-1 text-[11px]"
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
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-[11px] text-accent hover:underline font-medium transition-colors pt-1"
          >
            <FileText className="w-3 h-3" />
            <span>{isExpanded ? 'Hide Chunk Preview' : 'Show Chunk Preview'}</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          
          {isExpanded && (
            <div className="mt-2 p-2.5 bg-muted rounded-lg border border-border text-xs text-muted-foreground font-mono leading-relaxed max-h-40 overflow-y-auto">
              "{source.snippet}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
