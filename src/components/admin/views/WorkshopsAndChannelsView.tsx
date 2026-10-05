import React, { useState, useEffect } from 'react';
import { Building2, Radio, Zap, RefreshCw, AlertCircle, Terminal, CheckCircle2, XCircle } from 'lucide-react';
import {
  fetchPlatformWorkshops,
  fetchPlatformChannelsAndIntegrations,
  type PlatformWorkshopsState,
  type PlatformChannelsAndIntegrationsState
} from '../../../services/platformAdmin';
import type { PlatformWorkshopRow } from '../../../types';
import { WorkshopCapacityConfigSection } from './WorkshopCapacityConfigSection';

export interface WorkshopsAndChannelsViewProps {
  tenantId: string | null;
}

export const WorkshopsAndChannelsView: React.FC<WorkshopsAndChannelsViewProps> = ({ tenantId }) => {
  const [workshopsState, setWorkshopsState] = useState<PlatformWorkshopsState>({ status: 'idle' });
  const [channelsState, setChannelsState] = useState<PlatformChannelsAndIntegrationsState>({ status: 'idle' });
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    if (!tenantId) {
      setWorkshopsState({ status: 'idle' });
      setChannelsState({ status: 'idle' });
      return;
    }
    setIsLoading(true);
    const [wRes, cRes] = await Promise.all([
      fetchPlatformWorkshops(tenantId),
      fetchPlatformChannelsAndIntegrations(tenantId)
    ]);
    setWorkshopsState(wRes);
    if (wRes.status === 'success' && wRes.data && wRes.data.length > 0) {
      setSelectedWorkshopId((prev) => prev || wRes.data![0].id);
    }
    setChannelsState(cRes);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  if (!tenantId) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
        <div className="w-10 h-10 mx-auto rounded-xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center">
          <Terminal className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold text-white">Pendiente de Selección Autorizada</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Selecciona un tenant en la barra superior para inspeccionar sus talleres físicos, canales de comunicación e integraciones de software.
        </p>
      </div>
    );
  }

  const workshops = workshopsState.data || [];
  const endpoints = channelsState.endpoints || [];
  const integrations = channelsState.integrations || [];
  const selectedWorkshop = workshops.find((w) => w.id === selectedWorkshopId) || workshops[0] || null;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Talleres, Canales e Integraciones</h2>
            <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
              {tenantId}
            </span>
          </div>
          <p className="text-xs text-slate-500 pt-0.5">
            Configuración física y telemática del tenant: sedes de taller, puntos de entrada de canales (WhatsApp, Voz) e integraciones ERP.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition border border-slate-300 self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Grid: Workshops & Channel Endpoints */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Workshops Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Sedes de Taller ({workshops.length})</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">GET /workshops</span>
          </div>

          {workshopsState.status === 'loading' || isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400 font-mono">Cargando talleres...</div>
          ) : workshopsState.status === 'error' ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{workshopsState.message}</span>
            </div>
          ) : workshops.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">No hay talleres registrados para este tenant.</div>
          ) : (
            <div className="space-y-2">
              {workshops.map((w) => {
                const isSelected = w.id === selectedWorkshopId;
                return (
                  <div
                    key={w.id}
                    onClick={() => setSelectedWorkshopId(w.id)}
                    className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition border ${
                      isSelected
                        ? 'bg-blue-50/60 border-blue-500 shadow-2xs ring-1 ring-blue-500'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900">{w.name || w.id}</p>
                        {isSelected && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-600 text-white px-1.5 py-0.2 rounded">
                            Seleccionado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono">Zona horaria: {w.timezone}</p>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {w.id} (v{w.version})</span>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        w.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {w.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {w.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Channel Endpoints Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Puntos de Entrada / Canales ({endpoints.length})</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">GET /channel-endpoints</span>
          </div>

          {channelsState.status === 'loading' || isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400 font-mono">Cargando canales...</div>
          ) : channelsState.status === 'error' ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{channelsState.message}</span>
            </div>
          ) : endpoints.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">No hay canales de comunicación vinculados.</div>
          ) : (
            <div className="space-y-2">
              {endpoints.map((ep) => (
                <div key={ep.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 uppercase">{ep.provider}</span>
                      <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                        Cuenta: {ep.external_account_id}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-slate-600 mt-0.5">Destino: {ep.called_endpoint}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ep.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {ep.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Capacidad y Agenda: Selected Workshop Configuration */}
      {selectedWorkshop && (
        <WorkshopCapacityConfigSection
          tenantId={tenantId}
          workshop={selectedWorkshop}
          onWorkshopUpdated={() => {
            loadData();
          }}
        />
      )}

      {/* Integrations Row */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Integraciones de Plataforma ({integrations.length})</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">GET /integrations</span>
        </div>

        {channelsState.status === 'loading' || isLoading ? (
          <div className="py-8 text-center text-xs text-slate-400 font-mono">Cargando integraciones...</div>
        ) : integrations.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 italic">No hay conectores de software externos activos para este taller.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {integrations.map((it) => (
              <div key={it.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{it.provider}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    it.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {it.status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-mono">Tipo: {it.service_type}</p>
                <p className="text-[10px] text-slate-400 font-mono">ID: {it.id}</p>
                {it.updated_at && (
                  <p className="text-[10px] text-slate-400">Actualizado: {new Date(it.updated_at).toLocaleDateString()}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
