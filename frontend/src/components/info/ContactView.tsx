import React from 'react';
import { Mail, Globe, MapPin, ExternalLink, ShieldCheck, Sprout, Send } from 'lucide-react';

export const ContactView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 pb-2 border-b border-forest-800">
        <Mail className="w-5 h-5 text-emerald-400" />
        <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider">
          Contact & Organization Support
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Support Cards */}
        <div className="p-5 bg-forest-800/40 border border-forest-700/60 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 font-sans">
            <Sprout className="w-4 h-4 text-emerald-400" /> Technical & Research Support
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            Have questions regarding acAIcia model integration, CIFOR-ICRAF corpus updates, or API endpoint access? Contact our engineering team:
          </p>

          <div className="space-y-2 text-xs font-mono">
            <div className="p-3 bg-forest-900/80 border border-forest-700 rounded-xl flex items-center gap-3">
              <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
              <a href="mailto:support@acaicia.org" className="text-emerald-300 hover:underline">
                support@acaicia.org
              </a>
            </div>
            <div className="p-3 bg-forest-900/80 border border-forest-700 rounded-xl flex items-center gap-3">
              <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
              <a href="mailto:research@landscapealliance.org" className="text-emerald-300 hover:underline">
                research@landscapealliance.org
              </a>
            </div>
          </div>
        </div>

        {/* Organization Links */}
        <div className="p-5 bg-forest-800/40 border border-forest-700/60 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 font-sans">
            <Globe className="w-4 h-4 text-emerald-400" /> Participating Partner Organizations
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-forest-900/80 border border-forest-700 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">CIFOR-ICRAF</span>
                <span className="text-[10px] text-emerald-400 font-mono">Agroforestry Partner</span>
              </div>
              <p className="text-gray-400 text-[11px]">Center for International Forestry Research & World Agroforestry</p>
            </div>

            <div className="p-3 bg-forest-900/80 border border-forest-700 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Landscape Alliance</span>
                <span className="text-[10px] text-purple-400 font-mono">Research Lead</span>
              </div>
              <p className="text-gray-400 text-[11px]">Sustainable landscape management & open science initiatives</p>
            </div>
          </div>
        </div>
      </div>

      {/* Office & Regional Hub info */}
      <div className="p-4 bg-forest-900/60 border border-forest-700/50 rounded-xl flex items-center gap-3 text-xs text-gray-300">
        <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
        <div>
          <strong>Regional Agriscience Innovation Hub:</strong> Nairobi, Kenya & CGIAR Global Research Network.
        </div>
      </div>
    </div>
  );
};
