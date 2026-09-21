import React from 'react';

export const WorkflowSection: React.FC = () => {
  const steps = [
    {
      number: '01',
      title: 'Entra la petición',
      description:
        'El cliente se comunica con el taller por teléfono, WhatsApp o formulario web.',
    },
    {
      number: '02',
      title: 'Entiende y organiza',
      description:
        'BibendIA recoge el motivo de la consulta, solicita los datos necesarios (como matrícula y síntomas) y busca opciones de cita según las pautas de tu taller.',
    },
    {
      number: '03',
      title: 'Prepara la información',
      description:
        'Deja la cita registrada, puede informar al cliente cuando el taller ha actualizado el estado del vehículo o recopila los datos del trabajo a presupuestar.',
    },
    {
      number: '04',
      title: 'Pide tu intervención cuando hace falta',
      description:
        'Si hay una duda sobre una avería, una pieza no habitual o se requiere aprobación técnica, te presenta el caso ya resumido.',
    },
  ];

  return (
    <section id="como-opera" className="py-16 md:py-24 bg-white border-b border-workshop-border scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-graphite">
            Cómo opera BibendIA en recepción
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Un método de trabajo claro que acompaña la operativa de tu taller.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="bg-[#F8FAFC] p-6 rounded-xl border border-workshop-border flex flex-col justify-between"
            >
              <div>
                <div className="font-mono text-2xl font-bold text-cobalt-600 mb-3">
                  {step.number}
                </div>
                <h3 className="text-base font-bold text-graphite mb-2">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
