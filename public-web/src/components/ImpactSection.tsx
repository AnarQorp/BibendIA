import React from 'react';
import { Gauge, PhoneForwarded, Coffee } from 'lucide-react';

export const ImpactSection: React.FC = () => {
  const impacts = [
    {
      icon: Gauge,
      title: 'Continuidad en las reparaciones',
      description:
        'Más tiempo dedicado a los coches sin tener que interrumpir los trabajos mecánicos para atender cada llamada.',
    },
    {
      icon: PhoneForwarded,
      title: 'Recepción atendida mientras trabajas',
      description:
        'Clientes que reciben respuesta y quedan atendidos de forma ordenada, con el contexto registrado en su ficha.',
    },
    {
      icon: Coffee,
      title: 'Oficina al día',
      description:
        'Las citas anotadas y los datos de presupuestos recopilados durante la jornada reducen la acumulación de gestiones para la tarde.',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-white border-b border-workshop-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-graphite">
            Menos interrupciones en boxes, más trabajo terminado
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            El impacto no se mide en conceptos abstractos, sino en cómo transcurre el día a día.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {impacts.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="bg-[#F8FAFC] p-6 sm:p-7 rounded-xl border border-workshop-border flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-cobalt-600 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-graphite mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
