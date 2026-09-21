import React from 'react';
import { Layers, ShieldCheck, RefreshCw } from 'lucide-react';

export const CompatibilitySection: React.FC = () => {
  const points = [
    {
      icon: ShieldCheck,
      title: 'Sigue usando tu software habitual',
      description:
        'BibendIA no es un programa de facturación ni un ERP nuevo que te obligue a cambiar de sistema o reaprender la operativa del taller.',
    },
    {
      icon: Layers,
      title: 'Capa de recepción inteligente',
      description:
        'Se sitúa entre el cliente y tu taller para atender, filtrar y ordenar las peticiones antes de que se conviertan en interrupciones.',
    },
    {
      icon: RefreshCw,
      title: 'Adaptación progresiva',
      description:
        'Pensada para convivir de forma natural con los métodos de trabajo y las herramientas que ya utilizas en el día a día.',
    },
  ];

  return (
    <section id="compatibilidad" className="py-16 md:py-24 bg-[#F8FAFC] border-b border-workshop-border scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-graphite">
            Compatible con cómo trabajas hoy
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            BibendIA no pretende sustituir el programa de gestión de tu taller.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {points.map((point, idx) => {
            const Icon = point.icon;
            return (
              <div
                key={idx}
                className="bg-white p-6 sm:p-7 rounded-xl border border-workshop-border shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-graphite mb-2">{point.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{point.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
