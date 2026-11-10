import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Sparkles
} from 'lucide-react';
export const WelcomeInvitationView: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let t: string | null = null;
    if (typeof window !== 'undefined') {
      if (window.location.hash.includes('token=')) {
        t = new URLSearchParams(window.location.hash.slice(1)).get('token');
      }
      if (!t && window.location.search.includes('token=')) {
        t = new URLSearchParams(window.location.search).get('token');
      }
      if (t && window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
    setToken(t);
  }, []);

  const handleStartOidc = async () => {
    if (!token) {
      setErrorMessage('Token de invitación no encontrado en el enlace.');
      return;
    }

    setIsStarting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/auth/invitation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error || 'La invitación no es válida o ha caducado.');
        setIsStarting(false);
        return;
      }

      const data = await res.json();
      if (data.authorizationUrl) {
        if (typeof window !== 'undefined' && window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        window.location.replace(data.authorizationUrl);
      } else {
        setErrorMessage('Respuesta de autenticación incompleta.');
        setIsStarting(false);
      }
    } catch {
      setErrorMessage('Error de conexión al iniciar el flujo de autenticación.');
      setIsStarting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-white text-lg font-extrabold tracking-tight">Enlace de invitación no encontrado</h2>
            <p className="text-slate-400 text-xs">
              No se ha detectado el token de invitación en la dirección actual. Asegúrate de abrir el enlace tal como lo recibiste en tu correo o consulta a la administración del taller.
            </p>
          </div>
          <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl text-slate-400 text-[11px]">
            Para garantizar la soberanía de los datos, las invitaciones se canjean exclusivamente mediante proveedores OIDC autorizados.
          </div>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition"
          >
            Volver a la portada
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-[#0b1329] flex items-center justify-center p-4">
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl">
        {/* Brand header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-base shadow-md">
              B
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-extrabold text-base tracking-tight">BibendIA</span>
                <span className="text-[10px] font-mono uppercase bg-blue-950 text-blue-400 border border-blue-800 px-1.5 py-0.5 rounded">
                  Acceso Seguro
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Plataforma Operativa de Talleres</p>
            </div>
          </div>
        </div>

        {/* Welcome announcement */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs text-blue-400 font-bold bg-blue-950/60 border border-blue-800/60 px-2.5 py-1 rounded-lg">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Invitación Recibida</span>
          </div>
          <h1 className="text-white text-xl font-extrabold tracking-tight">
            Activa tu acceso de Taller
          </h1>
          <p className="text-slate-400 text-xs leading-relaxed">
            Has recibido una invitación para incorporarte a un taller en BibendIA. Para garantizar la seguridad del espacio de trabajo y verificar tu identidad, el acceso se realiza mediante tu proveedor OIDC corporativo.
          </p>
        </div>

        {/* Canonical OIDC Notice */}
        <div className="p-4 bg-slate-800/70 border border-slate-700/70 rounded-2xl space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-200 font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Autenticación OIDC Canónica</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Tu identidad será verificada comprobando que el correo electrónico verificado (<code className="text-slate-300">email_verified</code>) coincida exactamente con la invitación asignada.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 bg-rose-950/70 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleStartOidc}
            disabled={isStarting}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isStarting ? 'Iniciando autenticación OIDC...' : 'Verificar y Acceder con OIDC'}</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeInvitationView;
