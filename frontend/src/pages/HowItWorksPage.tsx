import React from 'react';
import { AcaiciaPageShell } from '../components/layout/AcaiciaPageShell';
import { Search, Sparkles, ShieldCheck, Database, Layers, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const HowItWorksPage: React.FC = () => {
  return (
    <AcaiciaPageShell
      eyebrow="Architecture & Pipeline"
      title="How acAIcia powers agriscience discovery."
      description="An end-to-end multi-agent retrieval-augmented synthesis system designed to connect field researchers with verified scientific publications."
    >
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
        {/* Pipeline Steps Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-accent">Stage 01</span>
              <ShieldCheck className="h-5 w-5 text-accent" />
            </div>
            <h3 className="mt-4 text-lg font-semibold tracking-tight">Guardian Agent</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Validates input domain relevance across forestry, peatland hydrology, soil health, and agroforestry taxonomy while blocking off-topic or unsafe prompts.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-accent">Stage 02</span>
              <Layers className="h-5 w-5 text-accent" />
            </div>
            <h3 className="mt-4 text-lg font-semibold tracking-tight">Query Architect</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Reformulates technical terms into entity-dense search parameters, preserving locations, DOIs, plant species, and quantitative metrics.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-accent">Stage 03</span>
              <Database className="h-5 w-5 text-accent" />
            </div>
            <h3 className="mt-4 text-lg font-semibold tracking-tight">Hybrid Retrieval</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Executes Reciprocal Rank Fusion (RRF) combining dense 768-D vector embeddings with PostgreSQL full-text keyword indexing.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-accent">Stage 04</span>
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <h3 className="mt-4 text-lg font-semibold tracking-tight">Synthesis Agent</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Generates rigorous academic answers with strict inline [Author, Year] citations linked directly to original publication DOIs.
            </p>
          </div>
        </div>

        {/* Detailed Explanation */}
        <div className="mt-16 rounded-xl border border-border bg-card p-8 shadow-sm">
          <h2 className="font-serif text-3xl font-medium tracking-tight">
            Scientific Rigor & Citation Protocol
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Unlike general-purpose conversational LLMs, acAIcia enforces strict citation discipline. Answers must draw exclusively from retrieved peer-reviewed literature, policy briefs, and technical manuals in the Landscape Alliance repository. Every factual claim is annotated with inline author-year markers, allowing researchers to trace every insight to its source document.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 border-t border-border pt-6">
            <Link
              to="/assistant"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground shadow hover:bg-secondary/90 transition-colors"
            >
              Try the Assistant now <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Learn about Landscape Alliance
            </Link>
          </div>
        </div>
      </div>
    </AcaiciaPageShell>
  );
};
