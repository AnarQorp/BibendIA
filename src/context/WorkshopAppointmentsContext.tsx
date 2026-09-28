import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { WorkshopAppointmentResponse } from '../types';
import {
  fetchWorkshopAppointments,
  getWorkshopTenantId,
  isAppointmentToday,
  isProvisionalIdentity,
  type WorkshopAppointmentsState,
} from '../services/workshopAppointments';
import { useDemo } from './DemoContext';

export interface WorkshopAppointmentsContextType {
  tenantId: string | null;
  state: WorkshopAppointmentsState;
  appointments: WorkshopAppointmentResponse[];
  todayAppointments: WorkshopAppointmentResponse[];
  provisionalAppointments: WorkshopAppointmentResponse[];
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

  const load = useCallback(async () => {
    const currentTenant = propTenantId ?? getWorkshopTenantId();
    setTenantId(currentTenant);

    if (!currentTenant) {
      setState({ status: 'awaiting_tenant' });
      return;
    }

    setState({ status: 'loading' });
    const res = await fetchWorkshopAppointments({ tenantId: currentTenant });
    setState(res);
  }, [propTenantId]);

  useEffect(() => {
    if (!demoModeActive) {
      load();
    }
  }, [demoModeActive, load]);

  const appointments = state.status === 'success' ? state.data : [];
  const todayAppointments = appointments.filter(a => isAppointmentToday(a.start_at));
  const provisionalAppointments = appointments.filter(isProvisionalIdentity);

  return (
    <WorkshopAppointmentsContext.Provider
      value={{
        tenantId,
        state,
        appointments,
        todayAppointments,
        provisionalAppointments,
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
