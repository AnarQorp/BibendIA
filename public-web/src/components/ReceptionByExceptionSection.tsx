import React from 'react';
import { Bot, UserCheck } from 'lucide-react';

export const ReceptionByExceptionSection: React.FC = () => {
  return (
    <section className="py-16 md:py-24 bg-[#F8FAFC] border-b border-workshop-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-graphite">
            Recepción por excepción: el profesional siempre decide
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            BibendIA resuelve el trabajo rutinario. La supervisión técnica y económica permanece en tus manos.
          </p>
        </div>

        {/* Esquema Conceptual Puro */}
        <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-workshop-border p-6 sm:p-10 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch relative">
            {/* Rutina Autónoma */}
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-cobalt-700 uppercase tracking-wider mb-3">
                  <Bot className="w-4 h-4 text-cobalt-600" />
                  BibendIA resuelve la rutina
                </div>
                <h3 className="text-base font-bold text-graphite mb-3">
                  Atención y tareas repetitivas
                </h3>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0"></span>
                    <span>Atender llamadas y mensajes entrantes en primera instancia.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0"></span>
                    <span>Anotar el motivo de la consulta y la matrícula del vehículo.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0"></span>
                    <span>Proponer y registrar citas en los horarios fijados por el taller.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0"></span>
                    <span>Avisar al cliente cuando el taller ha marcado el coche como terminado.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-3 border-t border-slate-200 text-xs font-medium text-slate-500">
                Resuelto sin interrumpir al mecánico en boxes
              </div>
            </div>

            {/* Supervisión de Excepciones */}
            <div className="p-6 bg-amber-50/50 rounded-xl border border-amber-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 uppercase tracking-wider mb-3">
                  <UserCheck className="w-4 h-4 text-amber-700" />
                  El profesional supervisa excepciones
                </div>
                <h3 className="text-base font-bold text-graphite mb-3">
                  Criterio técnico y económico
                </h3>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0"></span>
                    <span>Diagnósticos complejos o averías con síntomas atípicos.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0"></span>
                    <span>Validación y cierre de presupuestos con riesgo económico.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0"></span>
                    <span>Decisiones técnicas o de garantía que requieren criterio de taller.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0"></span>
                    <span>Cualquier caso donde la información del cliente sea incompleta.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-3 border-t border-amber-200 text-xs font-medium text-amber-900">
                El control de las decisiones siempre permanece en tus manos
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
            Tú decides las normas de tu taller; BibendIA se encarga de aplicarlas en recepción.
          </div>
        </div>
      </div>
    </section>
  );
};
