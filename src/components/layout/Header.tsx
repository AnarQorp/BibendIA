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
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md px-6 flex items-center justify-between shadow-xs">
      {/* Title */}
      <div>
        <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
          {getSectionTitle()}
        </h1>
        <p className="text-xs text-slate-500">Talleres Etxeberria · Recepción Taller</p>
      </div>

      {/* Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setAssistantModalOpen(true)}
          className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-1.5 flex items-center gap-3 text-xs text-slate-600 w-72 transition-all shadow-2xs"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="truncate text-slate-500">¿Qué necesitas?...</span>
          <kbd className="ml-auto bg-slate-200 text-slate-600 text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-300">⌘K</kbd>
        </button>

        <button
          onClick={startVoiceInput}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            isListening 
              ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse' 
              : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 shadow-2xs'
          }`}
          title="Dictar por voz"
        >
          <Mic className={`w-3.5 h-3.5 ${isListening ? 'text-rose-600 animate-bounce' : 'text-blue-600'}`} />
          <span>{isListening ? 'Escuchando...' : 'Hablar'}</span>
        </button>

        <div className="hidden lg:flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl text-xs font-medium text-slate-600">
          <Database className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Gestión:</span>
          <span className="text-emerald-700 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Conectado
          </span>
        </div>

        <button
          onClick={resetAllState}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          title="Reiniciar datos de la demo"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

