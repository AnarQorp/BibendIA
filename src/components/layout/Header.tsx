import React from 'react';
import { useDemo } from '../../context/DemoContext';
import { Mic, Search, Sparkles, Database, CheckCircle2, RotateCcw } from 'lucide-react';

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
      case 'midia': return 'Inicio — Mi Día en el Taller';
      case 'bandeja': return 'Bandeja Inteligente Multicanal';
      case 'agenda': return 'Agenda y Planificación de Trabajos';
      case 'presupuestos': return 'Presupuestos IA por Lenguaje Natural';
      case 'seguimientos': return 'Seguimientos y Oportunidades';
      case 'impacto': return 'Lo que BibendIA ha hecho por ti';
      case 'integraciones': return 'Configuración e Integraciones ERP / DMS';
      default: return 'BibendIA Recepción';
    }
  };

  return (
    <header className="h-16 bg-[#0b0f17]/90 border-b border-slate-800/80 sticky top-0 z-20 backdrop-blur-md px-6 flex items-center justify-between">
      {/* Page Title & Breadcrumb */}
      <div>
        <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
          {getSectionTitle()}
        </h1>
        <p className="text-xs text-slate-400">Talleres Etxeberria · Recepción Autónoma</p>
      </div>

      {/* Global AI Command Bar & Dictation trigger */}
      <div className="flex items-center gap-3">
        {/* Natural Language Search / Command Bar */}
        <button
          onClick={() => setAssistantModalOpen(true)}
          className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/80 rounded-lg px-3.5 py-1.5 flex items-center gap-3 text-xs text-slate-300 w-80 transition-all shadow-inner group"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-orange-400" />
          <span className="truncate text-slate-400">“Prepárame presupuesto para discos...”</span>
          <kbd className="ml-auto bg-slate-800 text-slate-400 text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700">⌘K</kbd>
        </button>

        {/* Voice Dictation Mic Button (Adjustment #3: Microphone -> Escuchando -> Transcription) */}
        <button
          onClick={startVoiceInput}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            isListening 
              ? 'bg-red-500/20 text-red-300 border-red-500/50 animate-pulse' 
              : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/30'
          }`}
          title="Dictar instrucción por voz al Asistente IA"
        >
          <Mic className={`w-3.5 h-3.5 ${isListening ? 'text-red-400 animate-bounce' : 'text-orange-400'}`} />
          <span>{isListening ? 'Escuchando...' : 'Dictar por voz'}</span>
        </button>

        {/* External DMS status indicator */}
        <div className="hidden lg:flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-300">
          <Database className="w-3 h-3 text-slate-400" />
          <span className="text-slate-400">Gestión:</span>
          <span className="text-emerald-400 flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3" /> Conectado
          </span>
        </div>

        {/* Reset State Button */}
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
