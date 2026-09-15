import React, { useState } from 'react';
import { useDemo } from '../../context/DemoContext';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Check, 
  User, 
  Car, 
  Wrench,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

export const AgendaView: React.FC = () => {
  const { appointments, customers, vehicles, confirmMartaAppointment } = useDemo();
  const [selectedDay, setSelectedDay] = useState<string>('2026-09-17'); // Thursday 17
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');

  const daysOfWeek = [
    { date: '2026-09-15', label: 'Mar 15', full: 'Martes 15' },
    { date: '2026-09-16', label: 'Mié 16', full: 'Miércoles 16' },
    { date: '2026-09-17', label: 'Jue 17', full: 'Jueves 17' },
    { date: '2026-09-18', label: 'Vie 18', full: 'Viernes 18' },
    { date: '2026-09-19', label: 'Sáb 19', full: 'Sábado 19' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      
      {/* Top Banner: Enriched Capacity Assistant */}
      <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 flex items-center justify-center font-extrabold text-sm shrink-0">
              ⚡
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">¿Cuándo puedo coger este coche?</h2>
              <p className="text-xs text-slate-300">
                BibendIA analiza la capacidad del taller y sugiere el mejor hueco disponible sin sobrecargar la agenda.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'week' ? 'bg-orange-500 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              Vista Semana
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'day' ? 'bg-orange-500 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              Vista Día
            </button>
          </div>
        </div>

        {/* 3 Capacity Enriched Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                ✓ Buen hueco
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Carga prevista: Baja</span>
            </div>
            <p className="text-sm font-bold text-white">Jueves 17 — 10:30 h</p>
            <p className="text-xs text-slate-400">Recomendado para revisión de Marta (75 min)</p>
            <button 
              onClick={() => confirmMartaAppointment('2026-09-17', '10:30')}
              className="w-full mt-2 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-xs transition-all"
            >
              Agendar para Jueves 10:30
            </button>
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2 py-0.5 rounded">
                ✓ Buen hueco
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Carga prevista: Óptima</span>
            </div>
            <p className="text-sm font-bold text-white">Viernes 18 — 08:30 h</p>
            <p className="text-xs text-slate-400">Hueco primera hora para trabajos rápidos (45 min)</p>
            <button 
              onClick={() => confirmMartaAppointment('2026-09-18', '08:30')}
              className="w-full mt-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-lg text-xs transition-all"
            >
              Agendar para Viernes 08:30
            </button>
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-purple-400 bg-purple-950/40 border border-purple-800/40 px-2 py-0.5 rounded">
                Disponible
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Carga prevista: Media</span>
            </div>
            <p className="text-sm font-bold text-white">Viernes 18 — 16:00 h</p>
            <p className="text-xs text-slate-400">Hueco libre de tarde en elevador 2</p>
            <button className="w-full mt-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-lg text-xs transition-all">
              Ver hueco tarde
            </button>
          </div>
        </div>
      </div>

      {/* Visual Weekly Workshop Grid (Nuance #1: Full Visual Calendar Grid) */}
      {viewMode === 'week' && (
        <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-orange-400" />
              <span>Calendario Semanal de Citas y Huecos Libres</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">Semana del 15 al 19 de Septiembre 2026</span>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {daysOfWeek.map(d => {
              const dayApps = appointments.filter(a => a.date === d.date || (d.date === '2026-09-17' && a.id.includes('marta')));
              const isSelected = selectedDay === d.date;

              return (
                <div 
                  key={d.date}
                  onClick={() => setSelectedDay(d.date)}
                  className={`bg-slate-900 border rounded-xl p-3 space-y-2 cursor-pointer transition-all ${
                    isSelected ? 'border-orange-500 shadow-md ring-1 ring-orange-500/50' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white">{d.full}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{dayApps.length} citas</span>
                  </div>

                  <div className="space-y-1.5 min-h-[140px]">
                    {dayApps.map(app => {
                      const veh = vehicles.find(v => v.id === app.vehicleId);
                      return (
                        <div key={app.id} className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-orange-400 text-[11px]">{app.time}</span>
                            {veh && <span className="license-plate text-[9px]">{veh.plate}</span>}
                          </div>
                          <p className="font-bold text-white truncate text-[11px]">{app.serviceName}</p>
                          <p className="text-[10px] text-slate-400">Técnico: {app.assignedMechanic || 'Jon'}</p>
                        </div>
                      );
                    })}

                    {dayApps.length === 0 && (
                      <div className="h-full flex items-center justify-center p-4 text-[11px] text-slate-500 text-center border border-dashed border-slate-800 rounded-lg">
                        Hueco libre disponible
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily List Schedule */}
      <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">
            Detalle de Citas — {daysOfWeek.find(d => d.date === selectedDay)?.full || 'Jueves 17'}
          </h3>
          <div className="flex items-center gap-2">
            {daysOfWeek.map(d => (
              <button
                key={d.date}
                onClick={() => setSelectedDay(d.date)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedDay === d.date ? 'bg-orange-500 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {appointments
            .filter(a => selectedDay === '2026-09-17' ? (a.date === '2026-09-17' || a.id.includes('marta')) : a.date === selectedDay)
            .map(app => {
              const customer = customers.find(c => c.id === app.customerId);
              const vehicle = vehicles.find(v => v.id === app.vehicleId);

              return (
                <div 
                  key={app.id} 
                  className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-slate-950 px-3.5 py-2.5 rounded-xl text-center border border-slate-800 shrink-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">HORA</span>
                      <span className="text-base font-extrabold text-orange-400">{app.time}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{app.serviceName}</h4>
                        {vehicle && <span className="license-plate">{vehicle.plate}</span>}
                      </div>
                      <p className="text-xs text-slate-300">
                        Cliente: <strong className="text-slate-200">{customer?.name}</strong> · {vehicle?.brand} {vehicle?.model}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-400 pt-0.5">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {app.estimatedDurationMinutes} min estim.</span>
                        <span>Asignado a: <strong className="text-slate-300">{app.assignedMechanic || 'Jon'}</strong></span>
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
                      {app.status === 'completed' ? 'Trabajo Terminado' : app.status === 'sent_to_dms' ? 'Enviado a Gestión' : 'Cita Confirmada'}
                    </span>
                  </div>
                </div>
              );
            })}

          {appointments.filter(a => selectedDay === '2026-09-17' ? (a.date === '2026-09-17' || a.id.includes('marta')) : a.date === selectedDay).length === 0 && (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-400 text-xs">
              Sin citas agendadas para esta fecha. Carga de taller 100% disponible.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
