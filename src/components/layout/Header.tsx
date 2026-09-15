import React from 'react';
import { useDemo } from '../../context/DemoContext';
import { Mic, Search, Database, CheckCircle2, RotateCcw } from 'lucide-react';

export const Header: React.FC = () => {
  const { 
    activeSection, 
    setAssistantModalOpen, 
    startVoiceInput, 
    isListening, 
    resetAllState 
  } = useDemo();

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'midia': return 'Inicio — Talleres Etxeberria';
      case 'bandeja': return 'Bandeja Multicanal';
      case 'agenda': return 'Agenda del Taller';
      case 'presupuestos': return 'Presupuestos';
      case 'seguimientos': return 'Seguimientos y Retención';
      case 'impacto': return 'Lo que BibendIA ha hecho por ti';
      case 'integraciones': return 'Configuración e Integraciones';
      default: return 'BibendIA';
    }
  };

  return (
    <header className="h-16 bg-[#0b0f17]/90 border-b border-slate-800 sticky top-0 z-20 backdrop-blur-md px-6 flex items-center justify-between">
      {/* Title */}
      <div>
        <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
          {getSectionTitle()}
        </h1>
        <p className="text-xs text-slate-400">Talleres Etxeberria · Recepción Taller</p>
      </div>

      {/* Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setAssistantModalOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg px-3.5 py-1.5 flex items-center gap-3 text-xs text-slate-300 w-72 transition-all shadow-inner"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="truncate text-slate-400">¿Qué necesitas?...</span>
          <kbd className="ml-auto bg-slate-800 text-slate-400 text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700">⌘K</kbd>
        </button>

        <button
          onClick={startVoiceInput}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            isListening 
              ? 'bg-red-950/60 text-red-300 border-red-800 animate-pulse' 
              : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/30'
          }`}
          title="Dictar por voz"
        >
          <Mic className={`w-3.5 h-3.5 ${isListening ? 'text-red-400 animate-bounce' : 'text-orange-400'}`} />
          <span>{isListening ? 'Escuchando...' : 'Hablar'}</span>
        </button>

        <div className="hidden lg:flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-300">
          <Database className="w-3 h-3 text-slate-400" />
          <span className="text-slate-400">Gestión:</span>
          <span className="text-emerald-400 flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3" /> Conectado
          </span>
        </div>

        <button
          onClick={resetAllState}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
          title="Reiniciar datos de la demo"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
