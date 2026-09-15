import React, { useState } from 'react';
import { useDemo } from '../../context/DemoContext';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  Check, 
  User, 
  Car, 
  Plus, 
  Wrench,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

export const AgendaView: React.FC = () => {
  const { appointments, customers, vehicles, confirmMartaAppointment } = useDemo();
  const [selectedDay, setSelectedDay] = useState<string>('2026-09-17'); // Wednesday
  const [quickSearchInput, setQuickSearchInput] = useState('');

  const martaApp = appointments.find(a => a.customerId === 'c1');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      
      {/* AI Assistant Headline: "¿Puedo coger este coche y cuándo?" */}
      <div className="bg-[#131b2e] border border-orange-500/30 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">¿Puedo coger este coche y cuándo?</h2>
              <p className="text-xs text-slate-300">
                La IA analiza la carga de trabajo del taller y duraciones estimadas para sugerir el mejor hueco sin sobrecargar el taller.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={quickSearchInput}
              onChange={e => setQuickSearchInput(e.target.value)}
              placeholder="Ej: Cambio de aceite Opel Astra..."
              className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 w-64 focus:outline-none focus:border-orange-500"
            />
            <button className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all shadow-md">
              Consultar Hueco
            </button>
          </div>
        </div>

        {/* AI Slot Proposal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 bg-slate-900/90 border border-slate-800 hover:border-orange-500/40 rounded-xl flex items-center justify-between transition-all">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                Hueco Óptimo Taller
              </span>
              <p className="text-sm font-bold text-white mt-1">Miércoles 17 — 10:30 h</p>
              <p className="text-xs text-slate-400">Duración estimada: 75 min (Revisión + Frenos)</p>
            </div>
            <button 
              onClick={() => confirmMartaAppointment('2026-09-17', '10:30')}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all shrink-0"
            >
              Agendar
            </button>
          </div>

          <div className="p-3.5 bg-slate-900/90 border border-slate-800 hover:border-orange-500/40 rounded-xl flex items-center justify-between transition-all">
            <div>
              <span className="text-[10px] font-bold text-blue-400 uppercase bg-blue-950/40 border border-blue-800/40 px-1.5 py-0.5 rounded">
                Hueco Mañana
              </span>
              <p className="text-sm font-bold text-white mt-1">Jueves 18 — 08:30 h</p>
              <p className="text-xs text-slate-400">Duración estimada: 45 min (Rápido)</p>
            </div>
            <button 
              onClick={() => confirmMartaAppointment('2026-09-18', '08:30')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-all shrink-0"
            >
              Agendar
            </button>
          </div>

          <div className="p-3.5 bg-slate-900/90 border border-slate-800 hover:border-orange-500/40 rounded-xl flex items-center justify-between transition-all">
            <div>
              <span className="text-[10px] font-bold text-purple-400 uppercase bg-purple-950/40 border border-purple-800/40 px-1.5 py-0.5 rounded">
                Hueco Tarde
              </span>
              <p className="text-sm font-bold text-white mt-1">Viernes 19 — 16:00 h</p>
              <p className="text-xs text-slate-400">Duración estimada: 60 min</p>
            </div>
            <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-all shrink-0">
              Agendar
            </button>
          </div>
        </div>
      </div>

      {/* Main Agenda Timetable */}
      <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        {/* Day Picker */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-orange-400" />
            <h3 className="text-base font-bold text-white">Planificación de Citas</h3>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSelectedDay('2026-09-15')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedDay === '2026-09-15' ? 'bg-orange-500 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              Hoy (Mar 15)
            </button>
            <button 
              onClick={() => setSelectedDay('2026-09-17')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedDay === '2026-09-17' ? 'bg-orange-500 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              Miércoles 17 (Marta)
            </button>
            <button 
              onClick={() => setSelectedDay('2026-09-18')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedDay === '2026-09-18' ? 'bg-orange-500 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              Jueves 18
            </button>
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="space-y-3">
          {appointments
            .filter(a => selectedDay === '2026-09-17' ? (a.date === '2026-09-17' || a.id.includes('marta')) : a.date === selectedDay)
            .map(app => {
              const customer = customers.find(c => c.id === app.customerId);
              const vehicle = vehicles.find(v => v.id === app.vehicleId);

              return (
                <div 
                  key={app.id} 
                  className="p-4 bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-slate-800 px-3 py-2 rounded-xl text-center shrink-0 border border-slate-700">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">HORA</span>
                      <span className="text-base font-extrabold text-orange-400">{app.time}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{app.serviceName}</h4>
                        {vehicle && <span className="license-plate">{vehicle.plate}</span>}
                        {app.aiCreated && (
                          <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Cita Gestionada por IA
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300">
                        Cliente: <strong className="text-slate-200">{customer?.name}</strong> · {vehicle?.brand} {vehicle?.model} ({vehicle?.motorization})
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-400 pt-0.5">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> {app.estimatedDurationMinutes} min estim.</span>
                        <span>Mecánico secundario: <strong className="text-slate-300">{app.assignedMechanic || 'Jon'}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                      app.status === 'completed' || app.status === 'sent_to_dms'
                        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                        : 'bg-blue-950/40 text-blue-400 border-blue-800/40'
                    }`}>
                      <Check className="w-3.5 h-3.5" />
                      {app.status === 'completed' ? 'Trabajo Finalizado' : app.status === 'sent_to_dms' ? 'Enviado a Gestión ERP' : 'Cita Confirmada'}
                    </span>
                  </div>
                </div>
              );
            })}

          {appointments.filter(a => selectedDay === '2026-09-17' ? (a.date === '2026-09-17' || a.id.includes('marta')) : a.date === selectedDay).length === 0 && (
            <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-xl text-center text-slate-400 text-xs">
              Sin citas agendadas para esta fecha. Hueco 100% disponible para recepción inteligente.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
