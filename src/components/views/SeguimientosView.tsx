import React from 'react';
import { useDemo } from '../../context/DemoContext';
import { 
  TrendingUp, 
  Send, 
  Check, 
  Clock, 
  MessageSquare, 
  Sparkles, 
  AlertCircle,
  Euro
} from 'lucide-react';

export const SeguimientosView: React.FC = () => {
  const { followups, customers, vehicles, sendFollowUp } = useDemo();

  const totalPotential = followups
    .filter(f => f.status === 'pending')
    .reduce((acc, f) => acc + f.potentialValue, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      
      {/* Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-extrabold text-base shrink-0">
            B
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Seguimientos y Recuperación de Clientes</h2>
            <p className="text-xs text-slate-500">
              BibendIA detecta autónomamente presupuestos pendientes, recomendaciones de visitas anteriores y revisiones caducadas.
            </p>
          </div>
        </div>

        <div className="bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-200 shrink-0 text-right">
          <span className="text-[10px] text-emerald-800 font-bold block uppercase">TRABAJO RECUPERABLE IDENTIFICADO</span>
          <span className="text-xl font-extrabold text-emerald-800 font-mono">{totalPotential.toFixed(2)} €</span>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="space-y-4">
        {followups.map(item => {
          const customer = customers.find(c => c.id === item.customerId);
          const vehicle = vehicles.find(v => v.id === item.vehicleId);
          const isSent = item.status === 'sent';

          return (
            <div 
              key={item.id}
              className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 transition-all ${
                item.type === 'unanswered_quote' ? 'telemetry-strip-amber' : 'telemetry-strip-cobalt'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                    item.type === 'unanswered_quote' 
                      ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                      : item.type === 'recommended_repair'
                      ? 'bg-blue-50 text-blue-800 border border-blue-200'
                      : 'bg-purple-50 text-purple-800 border border-purple-200'
                  }`}>
                    {item.type === 'unanswered_quote' ? 'Presupuesto Sin Respuesta' : item.type === 'recommended_repair' ? 'Recomendación Preventiva' : 'Mantenimiento Pendiente'}
                  </span>
                  {vehicle && <span className="license-plate">{vehicle.plate}</span>}
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Hace {item.daysPending} días
                  </span>
                  <span className="text-base font-extrabold text-slate-900 font-mono">
                    {item.potentialValue.toFixed(2)} €
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                <p className="text-xs text-slate-600">
                  Cliente: <strong className="text-slate-900 font-bold">{customer?.name}</strong> ({customer?.phone}) · {vehicle?.brand} {vehicle?.model}
                </p>
                <p className="text-xs text-slate-500">{item.description}</p>
              </div>

              {/* Pre-worded Message Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Mensaje WhatsApp Redactado por BibendIA:
                </div>
                <p className="text-slate-600 italic font-sans">"{item.suggestedMessage}"</p>
              </div>

              {/* Action Button (Electric Cobalt #2563EB) */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500 italic">
                  {isSent ? '✓ Seguimiento enviado' : 'Programado para envío de seguimiento'}
                </span>

                {!isSent ? (
                  <button
                    onClick={() => sendFollowUp(item.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all"
                  >
                    <Send className="w-4 h-4 text-white" />
                    <span>[Enviar Recordatorio por WhatsApp]</span>
                  </button>
                ) : (
                  <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" /> Seguimiento Enviado por WhatsApp
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

