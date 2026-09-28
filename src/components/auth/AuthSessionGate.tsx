import React, { useEffect, useState } from 'react';
import { loadHumanSession, logoutHumanSession, type HumanSession } from '../../services/humanSession';

export function AuthSessionGate({ expectedAudience, children }: {
  expectedAudience: 'workshop' | 'platform';
  children: (session: HumanSession) => React.ReactNode;
}) {
  const [state, setState] = useState<{ loading: boolean; session: HumanSession | null; error?: string }>({ loading: true, session: null });
  useEffect(() => {
    let active = true;
    loadHumanSession().then((session) => {
      if (!active) return;
      setState(session?.principal.audience === expectedAudience
        ? { loading: false, session }
        : { loading: false, session: null });
    }).catch(() => active && setState({ loading: false, session: null, error: 'No se pudo comprobar la sesión.' }));
    return () => { active = false; };
  }, [expectedAudience]);

  if (state.loading) return <AuthPanel title="Comprobando acceso…" />;
  if (!state.session) return <AuthPanel title={expectedAudience === 'platform' ? 'Acceso privado BibendIA Admin' : 'Acceso privado BibendIA Taller'} error={state.error} login />;
  return <>
    <button type="button" onClick={() => void logoutHumanSession()} className="fixed right-3 bottom-3 z-50 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-lg">
      Cerrar sesión
    </button>
    {children(state.session)}
  </>;
}

function AuthPanel({ title, error, login = false }: { title: string; error?: string; login?: boolean }) {
  return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
    <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-xl">
      <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-black">B</div>
      <h1 className="text-lg font-bold">{title}</h1>
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
      {login && <a href="/auth/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold hover:bg-blue-500">Iniciar sesión</a>}
    </div>
  </div>;
}
