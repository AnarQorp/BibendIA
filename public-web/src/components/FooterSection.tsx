import React from 'react';

export const FooterSection: React.FC = () => {
  return (
    <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src="./assets/logo_BibendIA.png"
              alt="BibendIA"
              className="h-8 w-auto object-contain"
            />
            <div>
              <span className="font-bold text-lg text-white">BibendIA</span>
              <p className="text-xs text-slate-400">La recepción inteligente de tu taller.</p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-300">
            <a href="#como-opera" className="hover:text-white transition">Cómo opera</a>
            <a href="#el-dia-a-dia" className="hover:text-white transition">El día a día</a>
            <a href="#canales" className="hover:text-white transition">Canales</a>
            <a href="#que-hace" className="hover:text-white transition">Qué hace</a>
            <a href="#compatibilidad" className="hover:text-white transition">Compatibilidad</a>
            <a href="#solicitar-demo" className="hover:text-white transition">Solicitar demo</a>
          </nav>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© 2026 BibendIA. Todos los derechos reservados.</p>
          <p className="text-slate-400 text-center sm:text-right">
            Recepción inteligente para talleres mecánicos de automoción.
          </p>
        </div>
      </div>
    </footer>
  );
};
