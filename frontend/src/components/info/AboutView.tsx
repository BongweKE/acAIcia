import React from 'react';
import { Info, ShieldCheck, Database, Cpu, Layers, BookOpen, ExternalLink, CheckCircle } from 'lucide-react';

export const AboutView: React.FC = () => {
  return (
    <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
      {/* Intro Hero Section */}
      <div className="p-5 bg-gradient-to-r from-emerald-950/40 via-forest-800/40 to-forest-900/40 border border-emerald-500/30 rounded-2xl space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-500/40">
            <Info className="w-5 h-5 text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-white font-sans">
            Mission: Evidence-Based Agriscience AI
          </h2>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">
          <strong className="text-emerald-300">acAIcia</strong> (Agriscience Context-Aware Artificial Intelligence Assistant) is an open-source, peer-reviewed RAG system built to empower agricultural researchers, extension officers, and soil scientists across Sub-Saharan Africa and global agro-ecological zones.
        </p>
      </div>

      {/* RAG Architecture Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
            Multi-Stage RAG Pipeline Architecture
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-4 bg-forest-800/40 border border-forest-700/60 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-purple-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-400" /> Stage 1: Safety Guardian
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                Security Filter
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Evaluates user inputs against prompt injection attacks, out-of-domain queries, and unsafe requests using regex boundary checks and classification rules.
            </p>
          </div>

          <div className="p-4 bg-forest-800/40 border border-forest-700/60 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-blue-300 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-blue-400" /> Stage 2: Agriscience Architect
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                Query Expander
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Expands botanical names, soil taxonomy terms (e.g. Ferralsols, Acrisols), and regional synonyms to maximize retrieval recall across scientific literature.
            </p>
          </div>

          <div className="p-4 bg-forest-800/40 border border-forest-700/60 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-teal-300 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-teal-400" /> Stage 3: Hybrid Retrieval
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800">
                Dense + BM25
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Combines Qdrant dense vector embeddings with BM25 keyword search using Reciprocal Rank Fusion (RRF) to retrieve relevant 512-token document chunks.
            </p>
          </div>

          <div className="p-4 bg-forest-800/40 border border-forest-700/60 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-emerald-300 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-emerald-400" /> Stage 4: Synthesis Engine
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                Verifiable LLM
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Synthesizes coherent, evidence-grounded answers with inline <code className="text-emerald-300 font-mono">[Author, Year]</code> citations and direct DOI document links.
            </p>
          </div>
        </div>
      </div>

      {/* Scientific Corpus Integration */}
      <div className="p-5 bg-forest-800/40 border border-forest-700/60 rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
            CIFOR-ICRAF Scientific Corpus Integration
          </h3>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">
          acAIcia is indexed directly against the World Agroforestry (ICRAF) and Center for International Forestry Research (CIFOR) digital repositories, incorporating:
        </p>
        <ul className="space-y-1.5 text-xs text-gray-400 list-none font-sans">
          <li className="flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Over 15,000 peer-reviewed agroforestry and soil science publications.</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>FAO & CGIAR agro-ecological datasets and trial assessments.</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Verifiable DOI links ensuring academic integrity and auditability.</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
