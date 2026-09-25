import React from 'react';
import {
  PhoneCall,
  Car,
  CalendarCheck,
  FileText,
  BellRing,
  HelpCircle,
} from 'lucide-react';

export const CapabilitiesSection: React.FC = () => {
  const capabilities = [
    {
      icon: PhoneCall,
      title: 'Atención de llamadas',
      description:
        'Atiende a los clientes cuando tú estás en el elevador, en el foso o con las manos en el motor.',
    },
    {
      icon: Car,
      title: 'Identificación de vehículo y cliente',
      description:
        'Pregunta los datos clave del vehículo para que sepas siempre de qué coche se trata.',
    },
    {
      icon: CalendarCheck,
      title: 'Organización de citas',
      description:
        'Anota las solicitudes en el calendario de acuerdo con el horario y tipo de trabajo de tu taller.',
    },
    {
      icon: FileText,
      title: 'Preparación de presupuestos',
      description:
        'Recopila lo que el cliente necesita para que tú solo tengas que revisar y validar el importe final.',
    },
    {
      icon: BellRing,
      title: 'Avisos de estado y recogida',
      description:
        'Puede informar al cliente cuando el taller ha actualizado el estado del vehículo y está listo para entregar.',
    },
    {
      icon: HelpCircle,
      title: 'Escalado de dudas',
      description:
        'Te transmite las consultas técnicas complejas con los datos ya ordenados para que decidas rápido.',
    },
  ];

  return (
    <section id="que-hace" className="py-16 md:py-24 bg-white border-b border-workshop-border scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-graphite">
            Diseñado para resolver el trabajo de recepción
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Lo que BibendIA gestiona para que tú puedas seguir trabajando.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {capabilities.map((cap, idx) => {
            const Icon = cap.icon;
            return (
              <div
                key={idx}
                className="bg-[#F8FAFC] p-6 rounded-xl border border-workshop-border flex flex-col justify-between hover:border-slate-300 transition"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-cobalt-600 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-graphite mb-2">{cap.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{cap.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
