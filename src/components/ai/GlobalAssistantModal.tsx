import React, { useState, useEffect } from 'react';
import { useDemo } from '../../context/DemoContext';
import { Mic, X, ArrowRight, Check, Calendar, FileText, Wrench, MessageSquare, AlertCircle } from 'lucide-react';

export const GlobalAssistantModal: React.FC = () => {
  const { 
    assistantModalOpen, 
    setAssistantModalOpen, 
    isListening, 
    startVoiceInput, 
    voiceQuery, 
    submitNaturalLanguageQuery,
    activeCommandResult,
    clearCommandResult
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

  const handleClose = () => {
    clearCommandResult();
    setAssistantModalOpen(false);
  };

  const workingCommands = [
    { text: "¿Qué tengo mañana?", category: "Agenda" },
    { text: "Dale cita a Roberto esta semana para cambio de aceite.", category: "Cita" },
    { text: "Prepárame presupuesto para discos y pastillas del BMW de Ander.", category: "Presupuesto" },
    { text: "¿Qué presupuestos llevan más de 3 días esperando?", category: "Seguimiento" },
    { text: "Avísale a Marta de que el coche está terminado.", category: "Aviso" },
    { text: "Apunta revisar los discos de Marta dentro de 6 meses.", category: "Recomendación" },
    { text: "¿Qué clientes debería contactar esta semana?", category: "Clientes" },
    { text: "El coche de Roberto ya está terminado.", category: "Gestión" }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-extrabold flex items-center justify-center text-sm">
              B
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">¿Qué necesitas?</h3>
              <p className="text-xs text-slate-500">Instrucciones directas por habla o escritura</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Listening Indicator */}
        {isListening && (
          <div className="p-3.5 bg-rose-50 border-b border-rose-200 flex items-center justify-center gap-3 text-rose-700 text-xs font-bold">
            <div className="w-3 h-3 rounded-full bg-rose-600 animate-ping"></div>
            <span>Escuchando... habla ahora la instrucción para el taller</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="Ej. Dale cita al Golf de Laura para el jueves..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 pr-28 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-sans"
              autoFocus
            />
            <div className="absolute right-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={startVoiceInput}
                className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-semibold ${
                  isListening ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title="Dictar por voz"
              >
                <Mic className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Hablar</span>
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl font-semibold transition-all shadow-xs"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Structured Command Result Overlay */}
          {activeCommandResult && (
            <div className="p-4 bg-slate-50 border border-blue-200 rounded-xl space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{activeCommandResult.title}</h4>
                  <p className="text-xs text-slate-600">{activeCommandResult.subtitle}</p>
                </div>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                  Entendido por BibendIA
                </span>
              </div>

              {activeCommandResult.wants && (
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800">
                  <span className="font-bold text-slate-500 block uppercase text-[10px]">Quieres:</span>
                  <p className="font-semibold text-slate-900 mt-0.5">{activeCommandResult.wants}</p>
                </div>
              )}

              {activeCommandResult.infoMessage && (
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700">
                  <p>{activeCommandResult.infoMessage}</p>
                </div>
              )}

              {activeCommandResult.slots && activeCommandResult.slots.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Huecos disponibles:</span>
                  <div className="space-y-1">
                    {activeCommandResult.slots.map((s, idx) => (
                      <div key={idx} className="p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 flex items-center justify-between">
                        <span>{s.label}</span>
                        <span className="text-[11px] text-emerald-700 font-bold">Disponible</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeCommandResult.actionLabel && activeCommandResult.actionFn && (
                <button
                  type="button"
                  onClick={activeCommandResult.actionFn}
                  className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
                >
                  <span>{activeCommandResult.actionLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Working Command Examples List */}
          {!activeCommandResult && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Órdenes soportadas en la demo:</p>
              
              <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                {workingCommands.map((cmd, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePresetClick(cmd.text)}
                    className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all flex items-center justify-between group text-xs text-slate-800"
                  >
                    <span className="truncate pr-2 font-medium">“{cmd.text}”</span>
                    <span className="text-[11px] font-bold text-slate-500 bg-white group-hover:text-blue-600 px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                      {cmd.category}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 text-center">
          BibendIA comprende la orden y propone la acción correspondiente.
        </div>
      </div>
    </div>
  );
};

