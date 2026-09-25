import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export const TopNavBar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-workshop-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Tag */}
          <div className="flex items-center gap-3">
            <a href="#" className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-cobalt-600 rounded">
              <img
                src="./assets/logo_BibendIA.png"
                alt="BibendIA Logo"
                className="h-8 w-auto object-contain"
              />
              <span className="font-bold text-xl tracking-tight text-graphite">BibendIA</span>
            </a>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              Recepción inteligente
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-700">
            <a href="#como-opera" className="hover:text-cobalt-600 transition">Cómo opera</a>
            <a href="#el-dia-a-dia" className="hover:text-cobalt-600 transition">El día a día</a>
            <a href="#canales" className="hover:text-cobalt-600 transition">Canales</a>
            <a href="#que-hace" className="hover:text-cobalt-600 transition">Qué hace</a>
            <a href="#compatibilidad" className="hover:text-cobalt-600 transition">Compatibilidad</a>
          </nav>

          {/* Desktop CTA Action */}
          <div className="hidden md:flex items-center">
            <a
              href="#solicitar-demo"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-cobalt-600 hover:bg-cobalt-700 active:bg-cobalt-800 rounded-md shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cobalt-600"
            >
              Solicitar una demo
            </a>
          </div>

          {/* Mobile Menu Button & Direct CTA */}
          <div className="flex items-center gap-2 md:hidden">
            <a
              href="#solicitar-demo"
              className="px-3 py-1.5 text-xs font-semibold text-white bg-cobalt-600 hover:bg-cobalt-700 rounded-md shadow-sm"
            >
              Demo
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-700 hover:text-graphite hover:bg-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-cobalt-600"
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-workshop-border bg-white px-4 pt-2 pb-4 space-y-2 shadow-lg">
          <a
            href="#como-opera"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Cómo opera
          </a>
          <a
            href="#el-dia-a-dia"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            El día a día
          </a>
          <a
            href="#canales"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Canales
          </a>
          <a
            href="#que-hace"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Qué hace
          </a>
          <a
            href="#compatibilidad"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Compatibilidad
          </a>
          <div className="pt-2">
            <a
              href="#solicitar-demo"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full text-center px-4 py-2.5 text-sm font-semibold text-white bg-cobalt-600 hover:bg-cobalt-700 rounded-md shadow-sm"
            >
              Solicitar una demo
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
