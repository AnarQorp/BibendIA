import React, { useState, useRef } from 'react';
import { Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import {
  type LeadFormData,
  validateLeadForm,
  submitLead,
  IdempotencyTracker,
} from '../services/leadService';

interface PilotFormSectionProps {
  onOpenPrivacy?: () => void;
}

export const PilotFormSection: React.FC<PilotFormSectionProps> = ({ onOpenPrivacy }) => {
  const [formData, setFormData] = useState<LeadFormData>({
    taller: '',
    nombre: '',
    telefono: '',
    email: '',
    mensaje: '',
    website: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const idempotencyTrackerRef = useRef<IdempotencyTracker>(new IdempotencyTracker());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Client-side validation
    const validation = validateLeadForm(formData);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      setSubmissionError(null);
      return;
    }

    setValidationErrors({});
    setSubmissionError(null);
    setIsSubmitting(true);

    try {
      const idempotencyKey = idempotencyTrackerRef.current.getKeyForAttempt(formData);
      const result = await submitLead(formData, idempotencyKey);

      if (result.ok) {
        idempotencyTrackerRef.current.onSuccess();
        setIsSuccess(true);
        // Clear sensitive PII fields from form state
        setFormData({
          taller: '',
          nombre: '',
          telefono: '',
          email: '',
          mensaje: '',
          website: '',
        });
      } else {
        setSubmissionError(
          result.userMessage || 'Ha ocurrido un error al procesar tu solicitud. Por favor, inténtalo de nuevo.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSuccess(false);
    setSubmissionError(null);
    setValidationErrors({});
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
          {isSuccess ? (
            <div className="py-6 px-4 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                ¡Solicitud recibida!
              </h3>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-md mx-auto">
                Hemos registrado los datos de tu taller. Nos pondremos en contacto contigo en breve para evaluar la prueba piloto.
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-slate-200 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                >
                  Enviar otra solicitud
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {submissionError && (
                <div
                  role="alert"
                  className="p-3.5 bg-rose-950/40 border border-rose-500/30 rounded-lg text-rose-200 text-sm flex items-start gap-2.5"
                >
                  <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 leading-snug">
                    {submissionError}
                  </div>
                </div>
              )}

              {/* Taller */}
              <div>
                <label htmlFor="taller" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Taller <span className="text-cobalt-400">*</span>
                </label>
                <input
                  id="taller"
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={formData.taller}
                  onChange={(e) => {
                    setFormData({ ...formData, taller: e.target.value });
                    if (validationErrors.taller) {
                      setValidationErrors({ ...validationErrors, taller: '' });
                    }
                  }}
                  placeholder="Nombre comercial de tu taller"
                  className={`w-full px-3.5 py-2.5 bg-slate-900 border rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:border-cobalt-500 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    validationErrors.taller ? 'border-rose-500' : 'border-slate-700'
                  }`}
                />
                {validationErrors.taller && (
                  <p className="mt-1 text-xs text-rose-400">{validationErrors.taller}</p>
                )}
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
                  disabled={isSubmitting}
                  value={formData.nombre}
                  onChange={(e) => {
                    setFormData({ ...formData, nombre: e.target.value });
                    if (validationErrors.nombre) {
                      setValidationErrors({ ...validationErrors, nombre: '' });
                    }
                  }}
                  placeholder="Persona de contacto"
                  className={`w-full px-3.5 py-2.5 bg-slate-900 border rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:border-cobalt-500 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    validationErrors.nombre ? 'border-rose-500' : 'border-slate-700'
                  }`}
                />
                {validationErrors.nombre && (
                  <p className="mt-1 text-xs text-rose-400">{validationErrors.nombre}</p>
                )}
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
                  disabled={isSubmitting}
                  value={formData.telefono}
                  onChange={(e) => {
                    setFormData({ ...formData, telefono: e.target.value });
                    if (validationErrors.telefono) {
                      setValidationErrors({ ...validationErrors, telefono: '' });
                    }
                  }}
                  placeholder="+34 600 000 000"
                  className={`w-full px-3.5 py-2.5 bg-slate-900 border rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:border-cobalt-500 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    validationErrors.telefono ? 'border-rose-500' : 'border-slate-700'
                  }`}
                />
                <span className="text-xs text-slate-400 mt-1 block">Formato internacional con prefijo (ej: +34 600 000 000)</span>
                {validationErrors.telefono && (
                  <p className="mt-1 text-xs text-rose-400">{validationErrors.telefono}</p>
                )}
              </div>

              {/* Email (opcional) */}
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Email <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  id="email"
                  type="email"
                  disabled={isSubmitting}
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (validationErrors.email) {
                      setValidationErrors({ ...validationErrors, email: '' });
                    }
                  }}
                  placeholder="correo@taller.com"
                  className={`w-full px-3.5 py-2.5 bg-slate-900 border rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:border-cobalt-500 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    validationErrors.email ? 'border-rose-500' : 'border-slate-700'
                  }`}
                />
                {validationErrors.email && (
                  <p className="mt-1 text-xs text-rose-400">{validationErrors.email}</p>
                )}
              </div>

              {/* Mensaje (opcional) */}
              <div>
                <label htmlFor="mensaje" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Mensaje <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  id="mensaje"
                  rows={3}
                  disabled={isSubmitting}
                  value={formData.mensaje}
                  onChange={(e) => {
                    setFormData({ ...formData, mensaje: e.target.value });
                    if (validationErrors.mensaje) {
                      setValidationErrors({ ...validationErrors, mensaje: '' });
                    }
                  }}
                  placeholder="Cuéntanos brevemente cómo gestionáis hoy la recepción y las llamadas"
                  className={`w-full px-3.5 py-2.5 bg-slate-900 border rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:border-cobalt-500 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    validationErrors.mensaje ? 'border-rose-500' : 'border-slate-700'
                  }`}
                />
                {validationErrors.mensaje && (
                  <p className="mt-1 text-xs text-rose-400">{validationErrors.mensaje}</p>
                )}
              </div>

              {/* Campo honeypot anti-bot fuera de flujo y no visible */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  width: '1px',
                  height: '1px',
                  padding: 0,
                  margin: '-1px',
                  overflow: 'hidden',
                  clip: 'rect(0, 0, 0, 0)',
                  whiteSpace: 'nowrap',
                  border: 0,
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              >
                <label htmlFor="website">Sitio web</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>

              {/* Botón de Envío */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-white bg-cobalt-600 hover:bg-cobalt-700 active:bg-cobalt-800 rounded-lg shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cobalt-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando solicitud...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Solicitar una demo
                    </>
                  )}
                </button>
                <p className="mt-2 text-center text-[11px] text-slate-400">
                  Consulta cómo tratamos tus datos en nuestra{' '}
                  <a
                    href="#politica-privacidad"
                    onClick={(e) => {
                      if (onOpenPrivacy) {
                        e.preventDefault();
                        onOpenPrivacy();
                      }
                    }}
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Política de privacidad
                  </a>
                  .
                </p>
              </div>
            </form>
          )}

          <p className="mt-4 text-center text-xs text-slate-400">
            Fase de preparación de pruebas piloto con talleres seleccionados.
          </p>
        </div>
      </div>
    </section>
  );
};
