import React, { useState } from 'react';
import { useDemo } from '../../context/DemoContext';
import { 
  FileText, 
  Check, 
  Send, 
  Plus, 
  Car, 
  User, 
  Clock, 
  Wrench, 
  HelpCircle,
  Edit2,
  AlertTriangle,
  Sparkles,
  ChevronLeft
} from 'lucide-react';

export const PresupuestosView: React.FC = () => {
  const { quotes, customers, vehicles, approveQuote, generateQuoteFromPrompt } = useDemo();
  const [promptInput, setPromptInput] = useState('');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>(quotes[0]?.id || '');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (promptInput.trim()) {
      generateQuoteFromPrompt(promptInput);
      setPromptInput('');
      setMobileView('detail');
    }
  };

  const activeQuote = quotes.find(q => q.id === selectedQuoteId) || quotes[0];
  const customer = customers.find(c => c.id === activeQuote?.customerId);
  const vehicle = vehicles.find(v => v.id === activeQuote?.vehicleId);

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Prompt Generator Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-extrabold text-base shrink-0">
            B
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Preparar Presupuesto con BibendIA</h2>
            <p className="text-xs text-slate-500">Escribe o dicta la intervención. BibendIA calcula recambios, mano de obra e IVA.</p>
          </div>
        </div>

        <form onSubmit={handleGenerateSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={promptInput}
            onChange={e => setPromptInput(e.target.value)}
            placeholder="Ej. Prepárame presupuesto para sustitución de pastillas de freno..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-sans"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all shrink-0"
          >
            <span>Preparar Presupuesto</span>
          </button>
        </form>
      </div>

      {/* Main Quote Layout: List | Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        
        {/* Left Column (4 cols on lg): Quote List */}
        <div className={`bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex-col gap-3 shadow-xs lg:col-span-4 ${
          mobileView === 'list' ? 'flex' : 'hidden lg:flex'
        }`}>
          <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-3">
            Presupuestos Registrados ({quotes.length})
          </h3>

          <div className="space-y-2.5">
            {quotes.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-500">No hay presupuestos registrados en el taller.</p>
            ) : quotes.map(q => {
              const cust = customers.find(c => c.id === q.customerId);
              const veh = vehicles.find(v => v.id === q.vehicleId);
              const isSelected = q.id === activeQuote?.id;

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setSelectedQuoteId(q.id);
                    setMobileView('detail');
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-1.5 ${
                    isSelected 
                      ? 'bg-blue-50/60 border-blue-300 shadow-2xs font-semibold' 
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-500">{q.number}</span>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${
                      q.status === 'pending_approval' 
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}>
                      {q.status === 'pending_approval' ? 'Pendiente Aprobar' : 'Enviado'}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 truncate">{q.title}</h4>
                  <p className="text-xs text-slate-500">{cust?.name} · {veh?.plate}</p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-400 font-mono">{q.createdDate}</span>
                    <span className="text-sm font-extrabold text-slate-900 font-mono">{q.total.toFixed(2)} €</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column (8 cols on lg): Detailed Quote View */}
        {activeQuote ? (
          <div className={`bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-6 shadow-xs lg:col-span-8 ${
            mobileView === 'detail' ? 'flex flex-col' : 'hidden lg:block'
          }`}>
            
            {/* Header / Meta */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMobileView('list')}
                    className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1 font-bold text-xs shrink-0 mr-1"
                    title="Volver a los presupuestos"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Lista</span>
                  </button>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md font-mono">
                    {activeQuote.number}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                    activeQuote.status === 'pending_approval'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}>
                    {activeQuote.status === 'pending_approval' ? 'Revisión pendiente' : 'Enviado por WhatsApp'}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">{activeQuote.title}</h3>
                <p className="text-xs text-slate-600">
                  Cliente: <strong className="text-slate-900 font-bold">{customer?.name}</strong> ({customer?.phone}) · Vehículo: <strong className="text-slate-900 font-bold">{vehicle?.brand} {vehicle?.model}</strong>
                </p>
              </div>

              {vehicle && <div className="shrink-0"><span className="license-plate">{vehicle.plate}</span></div>}
            </div>

            {/* Discrete Rationale Note */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs text-slate-700">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Estimación preparada por BibendIA:
              </span>
              <p className="italic text-slate-600">{activeQuote.aiRationale}</p>
            </div>

            {/* Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-3 px-3">Categoría</th>
                    <th className="py-3 px-3">Descripción Recambio / Operación</th>
                    <th className="py-3 px-3 text-center">Cant. / h</th>
                    <th className="py-3 px-3 text-right">Precio Unit.</th>
                    <th className="py-3 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {activeQuote.items.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-3">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          item.category === 'part' 
                            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {item.category === 'part' ? 'Recambio' : 'Mano de Obra'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{item.description}</td>
                      <td className="py-3 px-3 text-center font-mono">{item.quantity}</td>
                      <td className="py-3 px-3 text-right font-mono">{item.unitPrice.toFixed(2)} €</td>
                      <td className="py-3 px-3 text-right font-bold font-mono text-slate-900">{item.total.toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-600 space-y-0.5">
                <p>Mano de obra estimada: <strong className="text-slate-900 font-bold">{activeQuote.estimatedLaborHours} h</strong></p>
                <p>Tarifa taller: <strong className="text-slate-900 font-bold">50,00 € / hora</strong></p>
              </div>

              <div className="text-right space-y-1">
                <div className="text-xs text-slate-600 flex justify-between gap-8">
                  <span>Base Imponible:</span>
                  <span className="font-mono text-slate-900 font-bold">{activeQuote.subtotal.toFixed(2)} €</span>
                </div>
                <div className="text-xs text-slate-600 flex justify-between gap-8">
                  <span>IVA 21 %:</span>
                  <span className="font-mono text-slate-900 font-bold">{activeQuote.tax.toFixed(2)} €</span>
                </div>
                <div className="text-lg font-extrabold text-slate-900 flex justify-between gap-8 pt-1 border-t border-slate-200 font-mono">
                  <span>TOTAL:</span>
                  <span>{activeQuote.total.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            {/* Action Buttons (CTA "Aprobar y Enviar" MUST be Cobalt #2563EB) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
              <button 
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 flex items-center justify-center gap-1.5 transition-all min-h-[44px]"
              >
                <Edit2 className="w-4 h-4" />
                <span>Editar</span>
              </button>

              {activeQuote.status === 'pending_approval' ? (
                <button
                  onClick={() => approveQuote(activeQuote.id)}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-6 py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all min-h-[44px]"
                >
                  <Check className="w-4 h-4 text-white" />
                  <span>Aprobar y Enviar por WhatsApp</span>
                </button>
              ) : (
                <span className="w-full sm:w-auto bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 min-h-[44px]">
                  <Check className="w-4 h-4 text-emerald-600" /> Enviado por WhatsApp
                </span>
              )}
            </div>

          </div>
        ) : (
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-xs shadow-xs flex flex-col items-center justify-center gap-2">
            <FileText className="w-8 h-8 text-slate-300" />
            <p className="font-semibold text-slate-700">Sin presupuesto seleccionado</p>
            <p>Genera un presupuesto o selecciona uno del listado.</p>
          </div>
        )}

      </div>
    </div>
  );
};

