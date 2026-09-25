import React from 'react';
import { PhoneOff, CalendarSearch, Clock, FileSpreadsheet } from 'lucide-react';

export const DailyProblemsSection: React.FC = () => {
  const situations = [
    {
      icon: PhoneOff,
      title: 'Debajo del coche y suena el teléfono',
      description:
        'Estás con las manos ocupadas, montando una pieza o concentrado en una diagnosis. Tienes que parar, limpiarte y coger la llamada para no perder al cliente.',
    },
    {
      icon: CalendarSearch,
      title: '«¿Cuándo puedo llevar el coche?»',
      description:
        'Un cliente pide cita mientras tú estás en mitad de una reparación, intentando consultar la agenda o acordarte de memoria de los huecos libres.',
    },
    {
      icon: Clock,
      title: '«¿Está ya listo el mío?»',
      description:
        'Llamadas constantes a lo largo de la jornada sólo para saber cómo va la reparación o si el vehículo ya se puede pasar a recoger.',
    },
    {
      icon: FileSpreadsheet,
      title: 'Presupuestos que quedan para el final del día',
      description:
        'Tras horas en el elevador, la jornada continúa en la oficina recopilando notas, datos y consultas para elaborar presupuestos.',
    },
  ];

  return (
    <section id="el-dia-a-dia" className="py-16 md:py-24 bg-[#F8FAFC] border-b border-workshop-border scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-graphite">
            La realidad diaria de un taller mecánico
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Cuando estás reparando un coche, cada interrupción detiene el trabajo del taller.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {situations.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="bg-white p-6 sm:p-7 rounded-xl border border-workshop-border shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-graphite mb-2">{item.title}</h3>
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
