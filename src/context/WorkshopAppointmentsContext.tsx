import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { WorkshopAppointmentResponse } from '../types';
import {
  fetchWorkshopAppointments,
  getWorkshopTenantId,
  isAppointmentToday,
  isProvisionalIdentity,
  type WorkshopAppointmentsState,
} from '../services/workshopAppointments';
import { listReceptionCases, type ReceptionCase } from '../services/receptionCases';
import { useDemo } from './DemoContext';

export interface WorkshopAppointmentsContextType {
  tenantId: string | null;
  state: WorkshopAppointmentsState;
  appointments: WorkshopAppointmentResponse[];
  todayAppointments: WorkshopAppointmentResponse[];
  provisionalAppointments: WorkshopAppointmentResponse[];
  receptionCases: ReceptionCase[];
  pendingReceptionCases: ReceptionCase[];
  pendingCasesCount: number;
  refresh: () => Promise<void>;
}

const WorkshopAppointmentsContext = createContext<WorkshopAppointmentsContextType | undefined>(undefined);

export const WorkshopAppointmentsProvider: React.FC<{ tenantId?: string | null; children: React.ReactNode }> = ({ tenantId: propTenantId, children }) => {
  const { demoModeActive } = useDemo();
  const [tenantId, setTenantId] = useState<string | null>(() => propTenantId ?? getWorkshopTenantId());
  const [state, setState] = useState<WorkshopAppointmentsState>({ status: 'idle' });

  // Sync with prop changes if provided
  useEffect(() => {
    if (propTenantId) {
      setTenantId(propTenantId);
    }
  }, [propTenantId]);

  // Refresh tenantId from environment/URL on mount or popstate if not provided by prop
  useEffect(() => {
    if (propTenantId) return;
    const handleLocationChange = () => {
      const current = getWorkshopTenantId();
      setTenantId(current);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, [propTenantId]);

  const [receptionCases, setReceptionCases] = useState<ReceptionCase[]>([]);

  const load = useCallback(async () => {
    const currentTenant = propTenantId ?? getWorkshopTenantId();
    setTenantId(currentTenant);

    if (!currentTenant) {
      setState({ status: 'awaiting_tenant' });
      setReceptionCases([]);
      return;
    }

    setState({ status: 'loading' });
    const [appRes, casesRes] = await Promise.all([
      fetchWorkshopAppointments({ tenantId: currentTenant }),
      listReceptionCases(currentTenant, { limit: 100 }),
    ]);
    setState(appRes);
    if (casesRes.status === 'success' && casesRes.data) {
      setReceptionCases(casesRes.data);
    } else {
      setReceptionCases([]);
    }
  }, [propTenantId]);

  useEffect(() => {
    if (!demoModeActive) {
      load();
    }
  }, [demoModeActive, load]);

  const appointments = state.status === 'success' ? state.data : [];
  const todayAppointments = appointments.filter(a => isAppointmentToday(a.start_at));
  const provisionalAppointments = appointments.filter(isProvisionalIdentity);
  const pendingReceptionCases = receptionCases.filter(c =>
    ['OPEN', 'IN_PROGRESS', 'WAITING_WORKSHOP', 'WAITING_CUSTOMER'].includes(c.status)
  );
  const pendingCasesCount = pendingReceptionCases.length;

  return (
    <WorkshopAppointmentsContext.Provider
      value={{
        tenantId,
        state,
        appointments,
        todayAppointments,
        provisionalAppointments,
        receptionCases,
        pendingReceptionCases,
        pendingCasesCount,
        refresh: load,
      }}
    >
      {children}
    </WorkshopAppointmentsContext.Provider>
  );
};

export function useWorkshopAppointments(): WorkshopAppointmentsContextType {
  const context = useContext(WorkshopAppointmentsContext);
  if (!context) {
    throw new Error('useWorkshopAppointments must be used within a WorkshopAppointmentsProvider');
  }
  return context;
}
