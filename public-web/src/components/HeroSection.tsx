import React from 'react';
import { Wrench, PhoneCall, CheckCircle2, ArrowRight } from 'lucide-react';

export const HeroSection: React.FC = () => {
  return (
    <section className="relative overflow-hidden pt-8 pb-16 md:pt-14 md:pb-24 border-b border-workshop-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto flex flex-col items-center">
          {/* Premium 3D Hero Brand Stage */}
          <div className="relative mb-5 sm:mb-7 flex flex-col items-center justify-center group cursor-default select-none">
            {/* Ambient Multi-Spectrum Depth Aura */}
            <div
              className="absolute -top-4 sm:-top-6 left-1/2 -translate-x-1/2 w-48 h-48 sm:w-72 sm:h-72 lg:w-88 lg:h-88 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(37,99,235,0.18)_0%,rgba(56,189,248,0.10)_35%,rgba(241,245,249,0)_70%)] pointer-events-none -z-10 blur-xl transform-gpu group-hover:scale-105 transition-transform duration-700"
              aria-hidden="true"
            />

            {/* Tactile 3D Relief Pedestal Plaque */}
            <div className="relative rounded-[24px] sm:rounded-[32px] p-2 sm:p-3 bg-gradient-to-b from-white/95 via-slate-50/90 to-[#EDF2F7]/85 backdrop-blur-sm border border-white ring-1 ring-slate-200/70 shadow-[0_12px_28px_-6px_rgba(15,23,42,0.10),0_4px_14px_-2px_rgba(37,99,235,0.06),inset_0_1.5px_1px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(15,23,42,0.04)] transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_18px_36px_-6px_rgba(15,23,42,0.14),0_6px_18px_-2px_rgba(37,99,235,0.10)]">
              {/* Subtle Top Edge Specular Reflection */}
              <div
                className="absolute inset-x-4 sm:inset-x-8 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none rounded-t-full"
                aria-hidden="true"
              />

              {/* Inner Chamfered Bezel with Soft Horizon Light */}
              <div className="relative rounded-[18px] sm:rounded-[24px] px-2.5 py-2 sm:px-4 sm:py-3 bg-gradient-to-b from-white to-[#F8FAFC] border border-slate-100/80 shadow-[inset_0_1px_2.5px_rgba(0,0,0,0.02)] flex items-center justify-center">
                <img
                  src="./assets/logo_BibendIA.png"
                  alt="BibendIA Logo Mascot"
                  className="w-28 h-auto sm:w-36 md:w-44 lg:w-48 object-contain filter drop-shadow-[0_8px_14px_rgba(15,23,42,0.07)] drop-shadow-[0_2px_5px_rgba(37,99,235,0.05)]"
                  loading="eager"
                />
              </div>
            </div>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-cobalt-700 border border-blue-200 mb-5 sm:mb-6 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-cobalt-600 animate-pulse"></span>
            Recepción inteligente para talleres mecánicos
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-graphite leading-tight sm:leading-none">
            Pon a BibendIA en recepción y sigue trabajando.
          </h1>

          {/* Supporting Copy */}
          <p className="mt-5 text-base sm:text-lg lg:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Atiende clientes, organiza citas, prepara presupuestos y hace seguimiento mientras tú trabajas.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <a
              href="#solicitar-demo"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 text-base font-semibold text-white bg-cobalt-600 hover:bg-cobalt-700 active:bg-cobalt-800 rounded-md shadow-sm transition group"
            >
              Solicitar una demo
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a
              href="#como-opera"
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3.5 text-base font-medium text-slate-700 bg-white hover:bg-slate-50 border border-workshop-borderDark rounded-md shadow-sm transition"
            >
              Ver cómo opera ↓
            </a>
          </div>
        </div>

        {/* Operational Hero Split-Card Preview */}
        <div className="mt-12 lg:mt-16 max-w-5xl mx-auto">
          <div className="bg-white rounded-xl border border-workshop-border shadow-md overflow-hidden">
            {/* Top Status Bar */}
            <div className="bg-slate-900 px-4 py-3 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="font-semibold text-white">Taller en actividad</span>
                <span className="text-slate-400">·</span>
                <span>Boxes operativos</span>
              </div>
              <div className="text-slate-400 font-mono text-[11px]">
                Recepción BibendIA activa
              </div>
            </div>

            {/* Split Composition: Taller vs Recepción */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-workshop-border">
              {/* Lado Taller: El mecánico trabajando */}
              <div className="p-6 lg:p-8 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      <Wrench className="w-3.5 h-3.5 text-slate-500" />
                      Box 2 · Elevador 1
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                      En reparación
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-graphite mb-1">
                    Cambio de kit de distribución y bomba de agua
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Vehículo en el elevador · Manos ocupadas y desmontaje en curso
                  </p>

                  <div className="p-3 bg-white rounded-lg border border-workshop-border text-xs text-slate-600 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fase actual:</span>
                      <span className="font-medium text-slate-800">Calado de distribución</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Interrupciones:</span>
                      <span className="font-medium text-emerald-700">0 llamadas en boxes</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-workshop-border flex items-center gap-2 text-xs text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>El mecánico continúa su trabajo técnico sin atender el teléfono.</span>
                </div>
              </div>

              {/* Lado Recepción: BibendIA resolviendo */}
              <div className="p-6 lg:p-8 bg-white flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cobalt-700 uppercase tracking-wider">
                      <PhoneCall className="w-3.5 h-3.5 text-cobalt-600" />
                      Recepción de taller
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                      Llamada atendida
                    </span>
                  </div>

                  {/* Detalle de Atención */}
                  <div className="space-y-3">
                    {/* Matrícula y Vehículo */}
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center border border-slate-400 rounded bg-white overflow-hidden shadow-xs">
                        <div className="bg-cobalt-600 text-white font-bold text-[10px] px-1 py-1 leading-none flex flex-col items-center">
                          <span>E</span>
                        </div>
                        <div className="px-2 py-0.5 font-mono font-bold text-sm text-graphite tracking-widest">
                          8492 KMB
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-slate-800">SEAT León 2.0 TDI</span>
                    </div>

                    {/* Motivo recogido */}
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
                      <span className="font-semibold text-slate-700">Motivo:</span> Testigo de freno encendido · Solicita revisión y cambio de pastillas delanteras.
                    </div>

                    {/* Acción preparada */}
                    <div className="text-xs text-slate-700 space-y-1">
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cobalt-600 mt-1.5 shrink-0"></span>
                        <span>Solicitud de cita anotada para el <strong>jueves a las 10:30 h</strong> según disponibilidad de taller.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cobalt-600 mt-1.5 shrink-0"></span>
                        <span>Confirmación preparada para enviar al cliente.</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-workshop-border flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50/70 p-2.5 rounded">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">Registrado en recepción sin interrumpir el trabajo en boxes.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
