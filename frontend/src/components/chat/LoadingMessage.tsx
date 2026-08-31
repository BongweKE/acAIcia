import React, { useState, useEffect } from 'react';
import { Loader2, Sparkles, Sprout } from 'lucide-react';

export const RESEARCH_LOADING_MESSAGES = [
  "Synthesising peer-reviewed evidence from agroforestry literature...",
  "Querying hybrid vector index across forestry & climate publications...",
  "Analyzing tropical peatland hydrology & groundwater depth studies...",
  "Retrieving soil organic carbon sequestration & shade-grown crop metrics...",
  "Scanning smallholder maize yield & leguminous nitrogen fixation data...",
  "Verifying inline [Author, Year] citation tags & DOI hyperlinks...",
  "Cross-referencing silvopasture biodiversity & shade tree canopy density...",
  "Filtering burnt area remote sensing datasets & fire smoke haze studies...",
  "Synthesising low-emission food system & GHG mitigation policy briefs...",
  "Evaluating soil degradation & organic matter retention benchmarks...",
  "Extracting quantitative metrics from Landscape Alliance technical reports...",
  "Optimizing dense-vector & keyword RRF ranking across research documents...",
  "Cross-checking tropical forest canopy & carbon stock assessments...",
  "Aggregating species-level responses to drought & climate adaptation...",
  "Applying Reciprocal Rank Fusion across peer-reviewed literature excerpts...",
  "Formatting evidence-grounded answer with author-year transparency...",
];

export const LoadingMessage: React.FC = () => {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * RESEARCH_LOADING_MESSAGES.length));
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % RESEARCH_LOADING_MESSAGES.length);
        setFade(true);
      }, 200);
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 py-1 text-accent font-sans">
      <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className={`transition-opacity duration-200 ${fade ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground tracking-tight">
            <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="truncate">{RESEARCH_LOADING_MESSAGES[index]}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
            <Sprout className="w-3 h-3 text-accent/80 shrink-0" />
            <span>Ingesting literature excerpts, validating citations, and formulating response</span>
          </p>
        </div>
      </div>
    </div>
  );
};
