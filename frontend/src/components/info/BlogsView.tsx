import React from 'react';
import { BookOpen, Calendar, Tag, ArrowUpRight, User } from 'lucide-react';

export const BlogsView: React.FC = () => {
  const articles = [
    {
      title: 'Nitrogen Fixation & Biomass Dynamics in East Africa Agroforestry Systems',
      category: 'Agroforestry & Soil Nitrogen',
      date: 'August 2026',
      author: 'Dr. B. Obaga, ICRAF Research Fellow',
      summary:
        'Comparative trial analysis of Grevillea robusta, Acacia angustissima, and Sesbania sesban intercropping in Kenya and Uganda highlands. Quantifying organic matter contribution and soil N-fixation rates across 5-year crop rotation cycles.',
      doi: '10.1016/j.agroforest.2026.04.012',
    },
    {
      title: 'Shade Canopy Management in West & East African Cocoa Landscapes',
      category: 'Crop Yield & Microclimate',
      date: 'July 2026',
      author: 'Agriscience Research Team',
      summary:
        'Optimizing canopy openness between 30% and 40% balances microclimate humidity regulation, mirid pest suppression, and bean yields under shifting precipitation patterns in Sub-Saharan Africa.',
      doi: '10.1038/s41598-026-11892-x',
    },
    {
      title: 'Deep-Root Biomass & Soil Organic Carbon Accounting in Smallholder Systems',
      category: 'Soil Carbon & Climate',
      date: 'May 2026',
      author: 'CIFOR Carbon Accounting Group',
      summary:
        'Integrating mid-infrared spectroscopy (MIR) and remote sensing data to measure deep subsoil carbon storage beneath multi-strata agroforestry systems in the Lake Victoria basin.',
      doi: '10.1016/j.geoderma.2026.115802',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2">
        <BookOpen className="w-5 h-5 text-emerald-400" />
        <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider">
          Agriscience Research Articles & Insights
        </h2>
      </div>

      <div className="space-y-4">
        {articles.map((art, idx) => (
          <article
            key={idx}
            className="p-5 bg-forest-800/40 border border-forest-700/60 rounded-2xl space-y-3 hover:border-emerald-500/40 transition-all shadow-md group"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                {art.category}
              </span>
              <div className="flex items-center gap-3 text-[11px] text-gray-400 font-mono">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-gray-400" /> {art.date}
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 text-gray-400" /> {art.author}
                </span>
              </div>
            </div>

            <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors font-sans">
              {art.title}
            </h3>

            <p className="text-xs text-gray-300 leading-relaxed">{art.summary}</p>

            <div className="pt-2 border-t border-forest-800 flex items-center justify-between text-xs">
              <span className="font-mono text-[11px] text-emerald-400">DOI: {art.doi}</span>
              <a
                href={`https://doi.org/${art.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold text-[11px] transition-colors"
              >
                <span>Read Full Paper</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
