import React from 'react';
import { AcaiciaPageShell } from '../components/layout/AcaiciaPageShell';
import { ArrowRight, Leaf, ShieldCheck, Globe, Award } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AboutPage: React.FC = () => {
  return (
    <AcaiciaPageShell
      eyebrow="Mission & Organization"
      title="Empowering field decisions with open evidence."
      description="acAIcia is developed for Landscape Alliance (formerly CIFOR-ICRAF) to bridge the gap between scientific publications and frontline agricultural decision-making."
    >
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
        {/* Core Pillars */}
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent">
              <Leaf className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-xl font-semibold tracking-tight">Agroforestry Excellence</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Drawing on decades of CIFOR-ICRAF research across tropical peatlands, silvopasture systems, soil carbon dynamics, and sustainable land management.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-xl font-semibold tracking-tight">Evidence Integrity</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Designed to eliminate AI hallucinations by anchoring all answers in verified literature with full author-year citation transparency.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent">
              <Globe className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-xl font-semibold tracking-tight">Global Relevance</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Tailored to geographic contexts spanning East Africa, Southeast Asia, the Mediterranean, and South America for localized agronomic insights.
            </p>
          </div>
        </div>

        {/* Institution Brief */}
        <div className="mt-16 rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-accent font-semibold">
            <Award className="h-4 w-4 text-accent" /> Landscape Alliance
          </div>
          <h2 className="mt-4 font-serif text-3xl font-medium tracking-tight">
            About Landscape Alliance (formerly CIFOR-ICRAF)
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            The Center for International Forestry Research (CIFOR) and World Agroforestry (ICRAF) joined forces as Landscape Alliance to deliver actionable science-based solutions to climate change, deforestation, biodiversity loss, and rural poverty. acAIcia serves as an intelligent research gateway for scientists, development partners, and policy specialists.
          </p>

          <div className="mt-8 flex flex-wrap gap-4 border-t border-border pt-6">
            <Link
              to="/assistant"
              className="inline-flex items-center gap-2 rounded-md bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground shadow hover:bg-secondary/90 transition-colors"
            >
              Start Researching <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </AcaiciaPageShell>
  );
};
