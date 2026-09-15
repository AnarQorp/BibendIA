import React, { useState, useEffect } from 'react';
import { useDemo } from '../../context/DemoContext';
import { Mic, Sparkles, X, ArrowRight, CheckCircle2, Wrench, Calendar, FileText } from 'lucide-react';

export const GlobalAssistantModal: React.FC = () => {
  const { 
    assistantModalOpen, 
    setAssistantModalOpen, 
    isListening, 
    startVoiceInput, 
    voiceQuery, 
    submitNaturalLanguageQuery 
  } = useDemo();

  const [inputVal, setInputVal] = useState('');

  useEffect(() => {
    if (voiceQuery && voiceQuery !== 'Escuchando...') {
      setInputVal(voiceQuery);
    }
  }, [voiceQuery]);

  if (!assistantModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      submitNaturalLanguageQuery(inputVal);
    }
  };

  const handlePresetClick = (presetText: string) => {
    setInputVal(presetText);
    submitNaturalLanguageQuery(presetText);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#131b2e] border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Asistente Global BibendIA</h3>
              <p className="text-xs text-slate-400">Instrucciones por voz o texto directo</p>
            </div>
          </div>
          <button 
            onClick={() => setAssistantModalOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Listening / Dictation Indicator */}
        {isListening && (
          <div className="p-4 bg-red-950/30 border-b border-red-900/40 flex items-center justify-center gap-3 text-red-300 text-sm font-semibold">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-ping"></div>
            <span>Escuchando dictado del taller... habla ahora</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-5">
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="Ej: Prepárame presupuesto para discos y pastillas del BMW de Ander..."
              className="w-full bg-slate-950 border border-slate-700/90 rounded-xl px-4 py-3.5 pr-24 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-all shadow-inner"
              autoFocus
            />
            <div className="absolute right-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={startVoiceInput}
                className={`p-2 rounded-lg transition-all ${
                  isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title="Dictar por voz"
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-lg font-semibold transition-all shadow-md"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Action Presets */}
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ejemplos de dictado directo:</p>
            
            <button
              type="button"
              onClick={() => handlePresetClick("Prepárame presupuesto para discos y pastillas delanteras del BMW de Ander")}
              className="w-full text-left p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-3 group text-xs text-slate-200"
            >
              <FileText className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
              <div className="flex-1 truncate">
                <p className="font-semibold text-slate-100">Presupuesto en lenguaje natural</p>
                <p className="text-slate-400 text-[11px] truncate">“Prepárame presupuesto para discos y pastillas delanteras del BMW de Ander”</p>
              </div>
              <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded font-bold">1-Clic</span>
            </button>

            <button
              type="button"
              onClick={() => handlePresetClick("Dale cita a Marta el miércoles a las 10:30")}
              className="w-full text-left p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-3 group text-xs text-slate-200"
            >
              <Calendar className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
              <div className="flex-1 truncate">
                <p className="font-semibold text-slate-100">Agendar cita directamente</p>
                <p className="text-slate-400 text-[11px] truncate">“Dale cita a Marta Etxebarria para el miércoles a las 10:30”</p>
              </div>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-bold">Agendar</span>
            </button>

            <button
              type="button"
              onClick={() => handlePresetClick("Apunta que al Opel Astra de Roberto hay que revisar los neumáticos dentro de 6 meses")}
              className="w-full text-left p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-3 group text-xs text-slate-200"
            >
              <Wrench className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <div className="flex-1 truncate">
                <p className="font-semibold text-slate-100">Anotar recomendación preventiva de futuro</p>
                <p className="text-slate-400 text-[11px] truncate">“Revisar neumáticos del Opel Astra en 6 meses”</p>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">Seguimiento</span>
            </button>
          </div>
        </form>

        <div className="p-3 bg-slate-950 border-t border-slate-800/80 text-[11px] text-slate-400 text-center">
          BibendIA interpreta el contexto del vehículo, precios de tarifa del taller y tiempos de mano de obra automáticamente.
        </div>
      </div>
    </div>
  );
};
