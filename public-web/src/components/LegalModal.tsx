import React, { useEffect } from 'react';
import { X, Shield, FileText, Cookie } from 'lucide-react';
import {
  LEGAL_NOTICE_DATA,
  PRIVACY_POLICY_DATA,
  COOKIE_POLICY_DATA,
  type LegalDocument,
} from '../data/legalContent';

export type LegalTab = 'legal' | 'privacy' | 'cookies';

interface LegalModalProps {
  isOpen: boolean;
  activeTab: LegalTab;
  onClose: () => void;
  onTabChange: (tab: LegalTab) => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  activeTab,
  onClose,
  onTabChange,
}) => {
  useEffect(() => {
    if (isOpen) {
      // Disable body scroll when modal is open
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentDoc: LegalDocument =
    activeTab === 'legal'
      ? LEGAL_NOTICE_DATA
      : activeTab === 'privacy'
      ? PRIVACY_POLICY_DATA
      : COOKIE_POLICY_DATA;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] text-slate-800 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cobalt-50 text-cobalt-600 rounded-lg">
              {activeTab === 'legal' && <FileText className="w-5 h-5" />}
              {activeTab === 'privacy' && <Shield className="w-5 h-5" />}
              {activeTab === 'cookies' && <Cookie className="w-5 h-5" />}
            </div>
            <div>
              <h2 id="legal-modal-title" className="text-lg font-bold text-slate-900 leading-snug">
                {currentDoc.title}
              </h2>
              <p className="text-xs text-slate-500">
                {currentDoc.badge} · Actualizado: {currentDoc.updatedAt}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-cobalt-500"
            aria-label="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6 gap-2 sm:gap-6 overflow-x-auto shrink-0 text-sm font-medium">
          <button
            type="button"
            onClick={() => onTabChange('legal')}
            className={`py-3 border-b-2 whitespace-nowrap transition ${
              activeTab === 'legal'
                ? 'border-cobalt-600 text-cobalt-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Aviso Legal
          </button>
          <button
            type="button"
            onClick={() => onTabChange('privacy')}
            className={`py-3 border-b-2 whitespace-nowrap transition ${
              activeTab === 'privacy'
                ? 'border-cobalt-600 text-cobalt-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Política de Privacidad
          </button>
          <button
            type="button"
            onClick={() => onTabChange('cookies')}
            className={`py-3 border-b-2 whitespace-nowrap transition ${
              activeTab === 'cookies'
                ? 'border-cobalt-600 text-cobalt-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Cookies y almacenamiento
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto px-6 py-6 space-y-6 flex-1 text-sm text-slate-600 leading-relaxed">
          {/* Render regular document sections */}
          {currentDoc.sections.map((section, idx) => (
            <div key={idx} className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900">{section.heading}</h3>
              {section.content.map((p, pIdx) => (
                <p key={pIdx}>{p}</p>
              ))}
              {section.list && (
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  {section.list.map((item, itemIdx) => (
                    <li key={itemIdx}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-500">
            BibendIA © 2026 · Solución integral para talleres automoción
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-sm transition focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
