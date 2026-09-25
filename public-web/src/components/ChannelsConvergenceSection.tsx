import React from 'react';
import { Phone, MessageSquare, Globe, ArrowRight } from 'lucide-react';

export const ChannelsConvergenceSection: React.FC = () => {
  return (
    <section id="canales" className="py-16 md:py-24 bg-[#F8FAFC] border-b border-workshop-border scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-graphite">
            Da igual por dónde entre el cliente
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Teléfono, WhatsApp y web no son tres herramientas distintas: son accesos a la misma BibendIA.
          </p>
        </div>

        {/* Diagrama de Convergencia */}
        <div className="max-w-5xl mx-auto bg-white p-6 sm:p-10 rounded-2xl border border-workshop-border shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-11 gap-6 items-center">
            {/* 3 Canales de Entrada */}
            <div className="lg:col-span-4 space-y-3">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-md bg-blue-100 text-cobalt-700 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-graphite">Llamada telefónica</h3>
                  <p className="text-xs text-slate-500">Atención hablada directa con tono claro y profesional</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-graphite">WhatsApp del taller</h3>
                  <p className="text-xs text-slate-500">Mensajería directa para consultas y avisos</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-graphite">Página web</h3>
                  <p className="text-xs text-slate-500">Solicitudes de cita y contacto online</p>
                </div>
              </div>
            </div>

            {/* Flechas / Conector hacia Centro */}
            <div className="lg:col-span-3 flex flex-col items-center justify-center text-center p-4">
              <div className="hidden lg:flex items-center text-slate-400 my-2">
                <ArrowRight className="w-6 h-6 text-cobalt-600 animate-pulse" />
              </div>
              <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-sm w-full">
                <div className="text-xs font-mono text-blue-400 mb-1">Motor Central</div>
                <div className="font-bold text-base">BibendIA</div>
                <div className="text-[11px] text-slate-300 mt-1">Recepción unificada</div>
              </div>
              <div className="hidden lg:flex items-center text-slate-400 my-2">
                <ArrowRight className="w-6 h-6 text-cobalt-600 animate-pulse" />
              </div>
            </div>

            {/* Resultado Unificado */}
            <div className="lg:col-span-4 p-5 bg-blue-50/60 rounded-xl border border-blue-200">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-cobalt-800 mb-3">
                Expediente único
              </div>
              <h3 className="text-base font-bold text-graphite mb-2">
                Mantiene el contexto del taller
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                Da igual si el cliente primero llama por teléfono y luego responde por WhatsApp: BibendIA <strong>mantiene el contexto y organiza la información del cliente y vehículo</strong> en una sola recepción.
              </p>
              <div className="mt-4 pt-3 border-t border-blue-200/60 text-xs font-mono text-slate-600">
                Ficha de cliente · Matrícula · Cita
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
