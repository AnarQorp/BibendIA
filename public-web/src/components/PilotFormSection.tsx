import React, { useState } from 'react';
import { Send } from 'lucide-react';

export const PilotFormSection: React.FC = () => {
  const [formData, setFormData] = useState({
    taller: '',
    nombre: '',
    telefono: '',
    email: '',
    mensaje: '',
  });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const subject = `Solicitud de demo BibendIA — ${formData.taller}`;
    const body = [
      `Taller: ${formData.taller}`,
      `Nombre: ${formData.nombre}`,
      `Teléfono: ${formData.telefono}`,
      `Email: ${formData.email}`,
      `Mensaje: ${formData.mensaje}`,
    ].join('\n');

    window.location.href = `mailto:info@bibendia.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <section id="solicitar-demo" className="py-16 md:py-24 bg-slate-900 text-white scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
            ¿Quieres probar BibendIA en tu taller?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed">
            Actualmente estamos preparando las primeras pruebas piloto con talleres. Cuéntanos cómo gestionas tu recepción y valoramos si encaja en tu taller.
          </p>
        </div>

        <div className="max-w-xl mx-auto bg-slate-800/80 p-6 sm:p-8 rounded-2xl border border-slate-700 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Taller */}
            <div>
              <label htmlFor="taller" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Taller <span className="text-cobalt-400">*</span>
              </label>
              <input
                id="taller"
                type="text"
                required
                value={formData.taller}
                onChange={(e) => setFormData({ ...formData, taller: e.target.value })}
                placeholder="Nombre comercial de tu taller"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:border-cobalt-500 transition"
              />
            </div>

            {/* Nombre */}
            <div>
              <label htmlFor="nombre" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Nombre <span className="text-cobalt-400">*</span>
              </label>
              <input
                id="nombre"
                type="text"
                required
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Persona de contacto"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:border-cobalt-500 transition"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label htmlFor="telefono" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Teléfono <span className="text-cobalt-400">*</span>
              </label>
              <input
                id="telefono"
                type="tel"
                required
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                placeholder="Teléfono móvil o del taller"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:border-cobalt-500 transition"
              />
            </div>

            {/* Email (opcional) */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Email <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="correo@taller.com"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:border-cobalt-500 transition"
              />
            </div>

            {/* Mensaje (opcional) */}
            <div>
              <label htmlFor="mensaje" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Mensaje <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <textarea
                id="mensaje"
                rows={3}
                value={formData.mensaje}
                onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })}
                placeholder="Cuéntanos brevemente cómo gestionáis hoy la recepción y las llamadas"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:border-cobalt-500 transition"
              />
            </div>

            {/* Botón de Envío */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-white bg-cobalt-600 hover:bg-cobalt-700 active:bg-cobalt-800 rounded-lg shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cobalt-500"
              >
                <Send className="w-4 h-4 mr-2" />
                Solicitar una demo
              </button>
            </div>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            Fase de preparación de pruebas piloto con talleres seleccionados.
          </p>
        </div>
      </div>
    </section>
  );
};
