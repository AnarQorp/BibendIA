import React, { useState, useEffect } from 'react';
import { Cookie, Check } from 'lucide-react';
import {
  getStoredCookieConsent,
  acknowledgeStorageNotice,
  CONSENT_UPDATED_EVENT,
} from '../services/cookieConsent';

interface CookieBannerProps {
  onOpenPolicy: () => void;
}

export const CookieBanner: React.FC<CookieBannerProps> = ({
  onOpenPolicy,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if consent has already been stored
    const existing = getStoredCookieConsent();
    if (!existing) {
      setIsVisible(true);
    }

    const handleConsentUpdate = () => {
      setIsVisible(false);
    };

    window.addEventListener(CONSENT_UPDATED_EVENT, handleConsentUpdate);
    return () => {
      window.removeEventListener(CONSENT_UPDATED_EVENT, handleConsentUpdate);
    };
  }, []);

  if (!isVisible) return null;

  const handleAcknowledge = () => {
    acknowledgeStorageNotice();
    setIsVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Aviso de privacidad y almacenamiento local"
      className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 md:p-6 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 text-slate-200 shadow-2xl transition-all duration-300"
    >
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Information text */}
        <div className="flex items-start gap-3 flex-1 pr-0 lg:pr-4">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0 mt-0.5">
            <Cookie className="w-5 h-5" />
          </div>
          <div className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              <strong className="text-white font-semibold">Privacidad sin seguimiento:</strong>{' '}
              Esta web no utiliza analítica ni cookies publicitarias. Solo guarda en tu navegador una marca técnica
              para recordar que este aviso ya se mostró. El formulario no almacena tus datos en el navegador.
            </p>
            <div className="mt-1">
              <button
                type="button"
                onClick={onOpenPolicy}
                className="text-blue-400 hover:text-blue-300 underline font-medium focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
              >
                Más información
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full lg:w-auto shrink-0 pt-2 lg:pt-0">
          <button
            type="button"
            onClick={handleAcknowledge}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-cobalt-600 hover:bg-cobalt-700 active:bg-cobalt-800 rounded-lg shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-cobalt-500"
          >
            <Check className="w-4 h-4" />
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
