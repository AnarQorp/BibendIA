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
  AlertCircle,
  Sparkles
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
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">
      
      {/* Top Banner: Enriched Capacity Assistant */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-extrabold text-base shrink-0">
              B
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">¿Cuándo puedo coger este coche?</h2>
              <p className="text-xs text-slate-500">
                BibendIA analiza la capacidad del taller y sugiere el mejor hueco disponible sin sobrecargar la agenda.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'week' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Vista Semana
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'day' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Vista Día
            </button>
          </div>
        </div>

        {/* 3 Capacity Enriched Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="telemetry-strip-mint bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                ✓ Buen hueco
              </span>
              <span className="text-xs text-slate-500 font-mono">Carga: Baja</span>
            </div>
            <p className="text-sm font-bold text-slate-900">Jueves 17 — 10:30 h</p>
            <p className="text-xs text-slate-500">Recomendado para revisión de Marta (75 min)</p>
            <button 
              onClick={() => confirmMartaAppointment('2026-09-17', '10:30')}
              className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
            >
              Agendar para Jueves 10:30
            </button>
          </div>

          <div className="telemetry-strip-mint bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                ✓ Buen hueco
              </span>
              <span className="text-xs text-slate-500 font-mono">Carga: Óptima</span>
            </div>
            <p className="text-sm font-bold text-slate-900">Viernes 18 — 08:30 h</p>
            <p className="text-xs text-slate-500">Hueco primera hora para trabajos rápidos (45 min)</p>
            <button 
              onClick={() => confirmMartaAppointment('2026-09-18', '08:30')}
              className="w-full mt-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all"
            >
              Agendar para Viernes 08:30
            </button>
          </div>

          <div className="telemetry-strip-amber bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                Disponible
              </span>
              <span className="text-xs text-slate-500 font-mono">Carga: Media</span>
            </div>
            <p className="text-sm font-bold text-slate-900">Viernes 18 — 16:00 h</p>
            <p className="text-xs text-slate-500">Hueco libre de tarde en elevador 2</p>
            <button className="w-full mt-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all">
              Ver hueco tarde
            </button>
          </div>

        </div>
      </div>

      {/* Visual Weekly Workshop Grid */}
      {viewMode === 'week' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-blue-600" />
              <span>Calendario Semanal de Citas y Huecos Libres</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Semana del 15 al 19 de Septiembre 2026</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {daysOfWeek.map(d => {
              const dayApps = appointments.filter(a => a.date === d.date || (d.date === '2026-09-17' && a.id.includes('marta')));
              const isSelected = selectedDay === d.date;

              return (
                <div 
                  key={d.date}
                  onClick={() => setSelectedDay(d.date)}
                  className={`bg-white border rounded-2xl p-4 space-y-2.5 cursor-pointer transition-all ${
                    isSelected ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-xs' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">{d.full}</span>
                    <span className="text-xs text-slate-500 font-mono">{dayApps.length} citas</span>
                  </div>

                  <div className="space-y-2 min-h-[140px]">
                    {dayApps.map(app => {
                      const veh = vehicles.find(v => v.id === app.vehicleId);
                      return (
                        <div key={app.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-blue-600 text-xs font-mono">{app.time}</span>
                            {veh && <span className="license-plate">{veh.plate}</span>}
                          </div>
                          <p className="font-bold text-slate-900 truncate text-xs">{app.serviceName}</p>
                          <p className="text-[11px] text-slate-500">Mecánico: {app.assignedMechanic || 'Jon'}</p>
                        </div>
                      );
                    })}

                    {dayApps.length === 0 && (
                      <div className="h-full flex items-center justify-center p-4 text-xs text-slate-400 text-center border border-dashed border-slate-200 rounded-xl">
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
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-extrabold text-slate-900">
            Detalle de Citas — {daysOfWeek.find(d => d.date === selectedDay)?.full || 'Jueves 17'}
          </h3>
          <div className="flex items-center gap-2">
            {daysOfWeek.map(d => (
              <button
                key={d.date}
                onClick={() => setSelectedDay(d.date)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedDay === d.date ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3.5">
          {appointments
            .filter(a => selectedDay === '2026-09-17' ? (a.date === '2026-09-17' || a.id.includes('marta')) : a.date === selectedDay)
            .map(app => {
              const customer = customers.find(c => c.id === app.customerId);
              const vehicle = vehicles.find(v => v.id === app.vehicleId);

              return (
                <div 
                  key={app.id} 
                  className="telemetry-strip-cobalt bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-center shrink-0 font-mono">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">HORA</span>
                      <span className="text-base font-extrabold text-blue-600">{app.time}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">{app.serviceName}</h4>
                        {vehicle && <span className="license-plate">{vehicle.plate}</span>}
                      </div>
                      <p className="text-xs text-slate-600">
                        Cliente: <strong className="text-slate-900 font-bold">{customer?.name}</strong> · {vehicle?.brand} {vehicle?.model}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {app.estimatedDurationMinutes} min estim.</span>
                        <span>Asignado a: <strong className="text-slate-700 font-semibold">{app.assignedMechanic || 'Jon'}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                      app.status === 'completed' || app.status === 'sent_to_dms'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}>
                      <Check className="w-3.5 h-3.5" />
                      {app.status === 'completed' ? 'Trabajo Terminado' : app.status === 'sent_to_dms' ? 'Enviado a ERP' : 'Cita Confirmada'}
                    </span>
                  </div>
                </div>
              );
            })}

          {appointments.filter(a => selectedDay === '2026-09-17' ? (a.date === '2026-09-17' || a.id.includes('marta')) : a.date === selectedDay).length === 0 && (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
              Sin citas agendadas para esta fecha. Carga de taller 100% disponible.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

