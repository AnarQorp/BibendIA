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
      <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white">Seguimientos y Recuperación de Clientes</h2>
            <p className="text-xs text-slate-300">
              La IA detecta presupuestos pendientes, recomendaciones de visitas anteriores y revisiones caducadas para generar ingresos.
            </p>
          </div>
        </div>

        <div className="bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-800 shrink-0 text-right">
          <span className="text-[10px] text-slate-400 font-bold block uppercase">TRABAJO RECUPERABLE IDENTIFICADO</span>
          <span className="text-xl font-extrabold text-emerald-400">{totalPotential.toFixed(2)} €</span>
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
              className="bg-[#131b2e] border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg space-y-3 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded border ${
                    item.type === 'unanswered_quote' 
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                      : item.type === 'recommended_repair'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  }`}>
                    {item.type === 'unanswered_quote' ? 'Presupuesto Sin Respuesta' : item.type === 'recommended_repair' ? 'Recomendación Preventiva' : 'Mantenimiento Pendiente'}
                  </span>
                  {vehicle && <span className="license-plate">{vehicle.plate}</span>}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Hace {item.daysPending} días
                  </span>
                  <span className="text-sm font-extrabold text-emerald-400">
                    {item.potentialValue.toFixed(2)} €
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">{item.title}</h3>
                <p className="text-xs text-slate-300">
                  Cliente: <strong className="text-slate-100">{customer?.name}</strong> ({customer?.phone}) · {vehicle?.brand} {vehicle?.model}
                </p>
                <p className="text-xs text-slate-400">{item.description}</p>
              </div>

              {/* Pre-worded Message Card */}
              <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-orange-400 font-bold">
                  <Sparkles className="w-3.5 h-3.5" /> Mensaje WhatsApp Redactado por IA:
                </div>
                <p className="text-slate-300 italic">"{item.suggestedMessage}"</p>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-end pt-1">
                {!isSent ? (
                  <button
                    onClick={() => sendFollowUp(item.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-950/40 transition-all hover:scale-[1.02]"
                  >
                    <Send className="w-4 h-4" />
                    <span>[Enviar Recordatorio por WhatsApp]</span>
                  </button>
                ) : (
                  <span className="bg-emerald-950/60 border border-emerald-700/60 text-emerald-400 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Seguimiento Enviado
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
