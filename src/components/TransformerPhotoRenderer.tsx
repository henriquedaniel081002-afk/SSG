/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Camera, CheckCircle, AlertTriangle, Hammer, ShieldAlert } from 'lucide-react';

interface PhotoRendererProps {
  url: string;
  className?: string;
}

export const TransformerPhotoRenderer: React.FC<PhotoRendererProps> = ({ url, className = "w-full h-48" }) => {
  // If the URL is a real image from Base64, Supabase Storage or another public source, render it directly
  if (url.startsWith('data:image/') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return (
      <img
        src={url}
        alt="Registro fotográfico"
        className={`${className} object-cover rounded-lg border border-slate-200 shadow-sm`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // Pre-seeded SVG drawings that represent specific transformer diagnostic photos
  const baseClasses = `${className} rounded-lg border border-slate-200 bg-slate-50 relative flex flex-col items-center justify-center overflow-hidden p-4 select-none`;

  switch (url) {
    case 'vazamento_oleo':
      return (
        <div className={baseClasses}>
          {/* SVG Diagram of Transformer Flange leaking oil */}
          <svg viewBox="0 0 200 120" className="w-full h-28 text-slate-700">
            {/* Background wall */}
            <rect x="10" y="10" width="180" height="100" rx="4" fill="#e2e8f0" />
            {/* Steel Flange */}
            <rect x="40" y="40" width="120" height="40" rx="2" fill="#94a3b8" />
            <line x1="100" y1="40" x2="100" y2="80" stroke="#475569" strokeWidth="2" />
            {/* Bolts */}
            <circle cx="55" cy="50" r="4" fill="#475569" />
            <circle cx="55" cy="70" r="4" fill="#475569" />
            <circle cx="145" cy="50" r="4" fill="#475569" />
            <circle cx="145" cy="70" r="4" fill="#475569" />
            {/* Gasket showing wear */}
            <line x1="50" y1="60" x2="150" y2="60" stroke="#b45309" strokeWidth="3" strokeDasharray="5,3" />
            {/* Dripping oil */}
            <ellipse cx="100" cy="72" rx="4" ry="5" fill="#f59e0b" />
            <path d="M100,75 L100,110 C96,110 94,115 100,115 C106,115 104,110 100,110 Z" fill="#b45309" className="animate-pulse" />
            <circle cx="100" cy="113" r="6" fill="#b45309" opacity="0.9" />
            <ellipse cx="85" cy="115" rx="15" ry="3" fill="#b45309" opacity="0.8" />
          </svg>
          <div className="absolute top-2 left-2 bg-amber-600 text-white text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 uppercase tracking-wider shadow-sm">
            <AlertTriangle className="w-3 h-3" /> Vazamento
          </div>
          <span className="text-[11px] text-slate-500 font-mono mt-1">Esquema: Vazamento de Óleo</span>
        </div>
      );

    case 'reparo_oleo':
      return (
        <div className={baseClasses}>
          {/* SVG Diagram of Repaired Transformer Flange */}
          <svg viewBox="0 0 200 120" className="w-full h-28 text-slate-700">
            {/* Background wall */}
            <rect x="10" y="10" width="180" height="100" rx="4" fill="#e2e8f0" />
            {/* Steel Flange */}
            <rect x="40" y="40" width="120" height="40" rx="2" fill="#64748b" />
            <line x1="100" y1="40" x2="100" y2="80" stroke="#334155" strokeWidth="2" />
            {/* Bolts - tight and shiny */}
            <circle cx="55" cy="50" r="5" fill="#0f172a" />
            <circle cx="55" cy="70" r="5" fill="#0f172a" />
            <circle cx="145" cy="50" r="5" fill="#0f172a" />
            <circle cx="145" cy="70" r="5" fill="#0f172a" />
            {/* Brand New Cork Gasket */}
            <line x1="50" y1="60" x2="150" y2="60" stroke="#10b981" strokeWidth="4" />
          </svg>
          <div className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 uppercase tracking-wider shadow-sm">
            <CheckCircle className="w-3 h-3" /> Resolvido
          </div>
          <span className="text-[11px] text-slate-500 font-mono mt-1">Esquema: Junta de Vedação Nova</span>
        </div>
      );

    case 'sensor_com_defeito':
      return (
        <div className={baseClasses}>
          {/* SVG PT100 Damaged Wire */}
          <svg viewBox="0 0 200 120" className="w-full h-28 text-slate-700">
            <rect x="10" y="10" width="180" height="100" rx="4" fill="#f1f5f9" />
            {/* Sensor probe */}
            <rect x="30" y="55" width="60" height="10" rx="2" fill="#94a3b8" />
            {/* Broken insulation wires */}
            <path d="M90,60 C110,60 115,50 125,55 C130,58 132,68 138,62 C145,55 150,65 170,60" fill="none" stroke="#ef4444" strokeWidth="2.5" />
            {/* Exposed copper strands */}
            <path d="M124,55 L128,45" stroke="#ea580c" strokeWidth="1.5" />
            <path d="M125,56 L121,63" stroke="#ea580c" strokeWidth="1.5" />
            {/* Dial overlay */}
            <circle cx="165" cy="60" r="12" fill="#ef4444" opacity="0.2" />
            <path d="M158,60 L172,60" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2,2" />
          </svg>
          <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 uppercase tracking-wider shadow-sm">
            <ShieldAlert className="w-3 h-3" /> Fiação Rompida
          </div>
          <span className="text-[11px] text-slate-500 font-mono mt-1">Esquema: PT100 Danificado</span>
        </div>
      );

    case 'sensor_trocado':
      return (
        <div className={baseClasses}>
          {/* SVG PT100 Repaired Wire */}
          <svg viewBox="0 0 200 120" className="w-full h-28 text-slate-700">
            <rect x="10" y="10" width="180" height="100" rx="4" fill="#f1f5f9" />
            {/* Brand new probe */}
            <rect x="30" y="55" width="60" height="10" rx="2" fill="#64748b" />
            <rect x="85" y="52" width="10" height="16" rx="1" fill="#475569" />
            {/* Perfect armored cable */}
            <path d="M95,60 C115,60 120,60 135,60 C150,60 155,60 170,60" fill="none" stroke="#475569" strokeWidth="4" />
            {/* Heat shrink wrap */}
            <rect x="95" y="57" width="20" height="6" fill="#0f172a" />
          </svg>
          <div className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 uppercase tracking-wider shadow-sm">
            <CheckCircle className="w-3 h-3" /> Novo Sensor
          </div>
          <span className="text-[11px] text-slate-500 font-mono mt-1">Esquema: Sensor Blindado PT100</span>
        </div>
      );

    case 'bobina_queimada':
      return (
        <div className={baseClasses}>
          {/* SVG Displaced Wedge Coil */}
          <svg viewBox="0 0 200 120" className="w-full h-28 text-slate-700">
            <rect x="10" y="10" width="180" height="100" rx="4" fill="#f8fafc" />
            {/* Iron Core back */}
            <rect x="30" y="20" width="30" height="80" fill="#334155" />
            {/* Copper coils */}
            <rect x="70" y="25" width="80" height="20" rx="2" fill="#b45309" />
            <rect x="70" y="50" width="80" height="20" rx="2" fill="#b45309" />
            <rect x="70" y="75" width="80" height="20" rx="2" fill="#b45309" />
            {/* Wooden wedge popped out */}
            <rect x="110" y="42" width="35" height="12" rx="1" fill="#ea580c" transform="rotate(15 110 42)" />
            {/* Red alert glow */}
            <path d="M125,48 L145,35" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
            <line x1="140" y1="46" x2="155" y2="46" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="absolute top-2 left-2 bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 uppercase tracking-wider shadow-sm">
            <AlertTriangle className="w-3 h-3" /> Folga Mecânica
          </div>
          <span className="text-[11px] text-slate-500 font-mono mt-1">Esquema: Calço Deslocado</span>
        </div>
      );

    default:
      return (
        <div className={baseClasses}>
          <Camera className="w-10 h-10 text-slate-300 mb-2" />
          <span className="text-xs text-slate-400 font-medium">Foto não disponível</span>
        </div>
      );
  }
};
