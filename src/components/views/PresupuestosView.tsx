import React, { useState } from 'react';
import { useDemo } from '../../context/DemoContext';
import { 
  FileText, 
  Sparkles, 
  Check, 
  Send, 
  Plus, 
  Car, 
  User, 
  Clock, 
  Wrench, 
  HelpCircle,
  Edit2
} from 'lucide-react';

export const PresupuestosView: React.FC = () => {
  const { quotes, customers, vehicles, approveQuote, generateQuoteFromPrompt } = useDemo();
  const [promptInput, setPromptInput] = useState('');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>(quotes[0]?.id || '');

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (promptInput.trim()) {
      generateQuoteFromPrompt(promptInput);
      setPromptInput('');
    }
  };

  const activeQuote = quotes.find(q => q.id === selectedQuoteId) || quotes[0];
  const customer = customers.find(c => c.id === activeQuote?.customerId);
  const vehicle = vehicles.find(v => v.id === activeQuote?.vehicleId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Natural Language Prompt Generator Header */}
      <div className="bg-[#131b2e] border border-orange-500/30 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">Generar Presupuesto con Lenguaje Natural</h2>
            <p className="text-xs text-slate-300">Dicta o escribe las piezas y operaciones. La IA calcula recambios, tiempos de catálogo e IVA.</p>
          </div>
        </div>

        <form onSubmit={handleGenerateSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={promptInput}
            onChange={e => setPromptInput(e.target.value)}
            placeholder="Ej: Hazme presupuesto para discos y pastillas delanteras del BMW de Ander..."
            className="flex-1 bg-slate-950 border border-slate-700/90 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 shadow-inner"
          />
          <button
            type="submit"
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-extrabold px-5 py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generar Presupuesto IA</span>
          </button>
        </form>

        <div className="flex flex-wrap gap-2 text-[11px] text-slate-400 pt-1">
          <span className="text-slate-400 font-semibold">Ejemplos rápidos:</span>
          <button onClick={() => setPromptInput("Prepárame presupuesto para discos y pastillas delanteras del BMW de Ander")} className="hover:text-orange-400 underline">
            BMW Ander (Frenos)
          </button>
          <span>·</span>
          <button onClick={() => setPromptInput("Kit de distribución y bomba de agua Peugeot 308 de Iñaki")} className="hover:text-orange-400 underline">
            Peugeot Iñaki (Distribución)
          </button>
          <span>·</span>
          <button onClick={() => setPromptInput("Cambio de aceite 5W30 y filtro de aceite Opel Astra de Roberto")} className="hover:text-orange-400 underline">
            Opel Roberto (Aceite)
          </button>
        </div>
      </div>

      {/* Main Quote Layout: List | Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (4 cols): Quote List */}
        <div className="lg:col-span-4 bg-[#131b2e] border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
            Presupuestos Registrados ({quotes.length})
          </h3>

          <div className="space-y-2">
            {quotes.map(q => {
              const cust = customers.find(c => c.id === q.customerId);
              const veh = vehicles.find(v => v.id === q.vehicleId);
              const isSelected = q.id === activeQuote?.id;

              return (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuoteId(q.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1.5 ${
                    isSelected 
                      ? 'bg-slate-800 border-orange-500/50 shadow-md' 
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400">{q.number}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      q.status === 'pending_approval' 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {q.status === 'pending_approval' ? 'Pendiente Aprobar' : 'Enviado'}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-white truncate">{q.title}</h4>
                  <p className="text-[11px] text-slate-400">{cust?.name} · {veh?.plate}</p>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-400">{q.createdDate}</span>
                    <span className="text-sm font-extrabold text-amber-400">{q.total.toFixed(2)} €</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column (8 cols): Detailed Quote View */}
        {activeQuote && (
          <div className="lg:col-span-8 bg-[#131b2e] border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            
            {/* Header / Meta */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Preparado por IA
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">{activeQuote.number}</span>
                </div>
                <h3 className="text-xl font-extrabold text-white">{activeQuote.title}</h3>
                <p className="text-xs text-slate-300">
                  Cliente: <strong className="text-slate-100">{customer?.name}</strong> ({customer?.phone}) · Vehículo: <strong className="text-slate-100">{vehicle?.brand} {vehicle?.model}</strong> ({vehicle?.motorization})
                </p>
              </div>

              {vehicle && <div className="shrink-0"><span className="license-plate text-sm">{vehicle.plate}</span></div>}
            </div>

            {/* AI Rationale Note */}
            <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1 text-xs text-slate-300">
              <span className="font-bold text-orange-400 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" /> Explicación de Cálculo por IA:
              </span>
              <p className="italic">{activeQuote.aiRationale}</p>
            </div>

            {/* Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Categoría</th>
                    <th className="py-2.5 px-3">Descripción Operación / Recambio</th>
                    <th className="py-2.5 px-3 text-center">Cant. / Horas</th>
                    <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {activeQuote.items.map(item => (
                    <tr key={item.id} className="hover:bg-slate-900/40">
                      <td className="py-3 px-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          item.category === 'part' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                            : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                        }`}>
                          {item.category === 'part' ? 'Pieza Recambio' : 'Mano de Obra'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-white">{item.description}</td>
                      <td className="py-3 px-3 text-center font-mono">{item.quantity}</td>
                      <td className="py-3 px-3 text-right font-mono">{item.unitPrice.toFixed(2)} €</td>
                      <td className="py-3 px-3 text-right font-bold font-mono">{item.total.toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-400 space-y-0.5">
                <p>Tiempo estimado de intervención: <strong className="text-slate-200">{activeQuote.estimatedLaborHours} h</strong></p>
                <p>Tarifa mano de obra taller aplicada: <strong className="text-slate-200">50,00 € / hora</strong></p>
              </div>

              <div className="text-right space-y-1">
                <div className="text-xs text-slate-400 flex justify-between gap-8">
                  <span>Subtotal:</span>
                  <span className="font-mono text-slate-200 font-bold">{activeQuote.subtotal.toFixed(2)} €</span>
                </div>
                <div className="text-xs text-slate-400 flex justify-between gap-8">
                  <span>IVA (21%):</span>
                  <span className="font-mono text-slate-200 font-bold">{activeQuote.tax.toFixed(2)} €</span>
                </div>
                <div className="text-lg font-extrabold text-amber-400 flex justify-between gap-8 pt-1 border-t border-slate-800">
                  <span>TOTAL:</span>
                  <span className="font-mono">{activeQuote.total.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            {/* Primary Action Button (Adjustment #4: 1-click Approve & Send) */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all"
              >
                <Edit2 className="w-4 h-4" />
                <span>[Editar]</span>
              </button>

              {activeQuote.status === 'pending_approval' ? (
                <button
                  onClick={() => approveQuote(activeQuote.id)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-6 py-3 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all hover:scale-[1.02]"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>[Aprobar y Enviar WhatsApp]</span>
                </button>
              ) : (
                <span className="bg-emerald-950/60 border border-emerald-700/60 text-emerald-400 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Presupuesto Enviado al Cliente por WhatsApp
                </span>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
