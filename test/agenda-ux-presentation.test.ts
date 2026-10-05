import { describe, it, expect } from 'vitest';
import { formatAppointmentSource, formatAppointmentStatus, formatCustomerWaitMode } from '../src/utils/workshopFormatters';
import {
  computeDayOperationalMetrics,
  formatAppointmentForPresentation,
  ALLOWED_OPERATIONAL_TRANSITIONS
} from '../src/components/views/AgendaView';
import type { WorkshopAppointmentResponse, WorkshopCustomer, WorkshopVehicle } from '../src/types';

describe('Agenda UX Presentation and Operational Logic', () => {
  describe('formatAppointmentStatus', () => {
    it('translates canonical statuses to natural workshop terminology with proper badge styles', () => {
      const confirmed = formatAppointmentStatus('confirmed');
      expect(confirmed.label).toBe('Confirmada');
      expect(confirmed.bg).toContain('emerald');

      const awaitingArrival = formatAppointmentStatus('awaiting_arrival');
      expect(awaitingArrival.label).toBe('Pendiente de llegada');

      const onSite = formatAppointmentStatus('on_site');
      expect(onSite.label).toBe('En taller');

      const inProgress = formatAppointmentStatus('in_progress');
      expect(inProgress.label).toBe('En trabajo');

      const waiting = formatAppointmentStatus('waiting');
      expect(waiting.label).toBe('En espera');

      const completed = formatAppointmentStatus('completed');
      expect(completed.label).toBe('Lista');

      const delivered = formatAppointmentStatus('delivered');
      expect(delivered.label).toBe('Entregada');

      const tentative = formatAppointmentStatus('tentative');
      expect(tentative.label).toBe('Tentativa');
      expect(tentative.bg).toContain('amber');

      const held = formatAppointmentStatus('held');
      expect(held.label).toBe('En espera');

      const cancelled = formatAppointmentStatus('cancelled');
      expect(cancelled.label).toBe('Cancelada');
      expect(cancelled.bg).toContain('rose');

      const fallback = formatAppointmentStatus(null);
      expect(fallback.label).toBe('Registrada');
    });
  });

  describe('formatCustomerWaitMode', () => {
    it('translates customer wait mode correctly to Spanish workshop semantics', () => {
      expect(formatCustomerWaitMode('DROP_OFF').label).toBe('Deja el coche');
      expect(formatCustomerWaitMode('WAIT_ON_SITE').label).toBe('Espera');
      expect(formatCustomerWaitMode(undefined).label).toBe('Deja el coche');
    });
  });

  describe('ALLOWED_OPERATIONAL_TRANSITIONS', () => {
    it('defines accurate transitions conforming to backend state machine without invalid steps', () => {
      expect(ALLOWED_OPERATIONAL_TRANSITIONS.confirmed).toEqual([
        { nextStatus: 'on_site', label: 'Marcar llegada', primary: true }
      ]);
      expect(ALLOWED_OPERATIONAL_TRANSITIONS.on_site).toEqual([
        { nextStatus: 'in_progress', label: 'Iniciar trabajo', primary: true }
      ]);
      expect(ALLOWED_OPERATIONAL_TRANSITIONS.in_progress).toEqual([
        { nextStatus: 'waiting', label: 'Poner en espera' },
        { nextStatus: 'completed', label: 'Completar trabajo', primary: true }
      ]);
      expect(ALLOWED_OPERATIONAL_TRANSITIONS.completed).toEqual([
        { nextStatus: 'delivered', label: 'Entregar vehículo', primary: true }
      ]);
      expect(ALLOWED_OPERATIONAL_TRANSITIONS.delivered).toEqual([]);
      expect(ALLOWED_OPERATIONAL_TRANSITIONS.cancelled).toEqual([]);
    });
  });

  describe('formatAppointmentSource', () => {
    it('translates canonical appointment origins with Spanish badges', () => {
      const voice = formatAppointmentSource('voice_phone');
      expect(voice.label).toBe('Teléfono');
      expect(voice.sourceKey).toBe('voice_phone');
      expect(voice.bg).toContain('blue');

      const web = formatAppointmentSource('web_lead');
      expect(web.label).toBe('Web');
      expect(web.sourceKey).toBe('web_lead');
      expect(web.bg).toContain('emerald');

      const dms = formatAppointmentSource('dms_import');
      expect(dms.label).toBe('DMS');
      expect(dms.sourceKey).toBe('dms_import');
      expect(dms.bg).toContain('amber');

      const manual = formatAppointmentSource('workshop_manual');
      expect(manual.label).toBe('Taller');
      expect(manual.sourceKey).toBe('workshop_manual');
    });
  });

  describe('Operational Day Metrics Calculation', () => {
    it('computes observable metrics accurately from day appointments using computeDayOperationalMetrics', () => {
      const appointments = [
        { timeStr: '09:00', durationMinutes: 45, status: 'confirmed' },
        { timeStr: '11:30', durationMinutes: 60, status: 'confirmed' },
        { timeStr: '16:00', durationMinutes: 30, status: 'tentative' },
        { timeStr: '17:00', durationMinutes: 30, status: 'held' }
      ];

      const metrics = computeDayOperationalMetrics(appointments);

      expect(metrics.totalCount).toBe(4);
      expect(metrics.firstAppointmentTime).toBe('09:00');
      expect(metrics.totalHours).toBe(2);
      expect(metrics.remainingMinutes).toBe(45);
      expect(metrics.confirmedCount).toBe(2);
      expect(metrics.tentativeCount).toBe(2);
    });

    it('handles empty day metrics cleanly without crashing or simulating capacity', () => {
      const metrics = computeDayOperationalMetrics([]);

      expect(metrics.totalCount).toBe(0);
      expect(metrics.firstAppointmentTime).toBeNull();
      expect(metrics.totalHours).toBe(0);
      expect(metrics.remainingMinutes).toBe(0);
      expect(metrics.confirmedCount).toBe(0);
      expect(metrics.tentativeCount).toBe(0);
    });
  });

  describe('formatAppointmentForPresentation & Zero Technical Leaks', () => {
    const rawAppointment: WorkshopAppointmentResponse = {
      id: 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c',
      tenant_id: '11111111-2222-3333-4444-555555555555',
      workshop_id: '99999999-8888-7777-6666-555555555555',
      case_id: 'f0e1d2c3-b4a5-6789-0123-456789abcdef',
      customer_id: 'c1111111-2222-3333-4444-555555555555',
      vehicle_id: 'v1111111-2222-3333-4444-555555555555',
      identity_resolution: 'verified',
      service_request: {
        intent: 'Cambio de pastillas delanteras y revisión',
        symptoms: ['Ruido metálico al frenar'],
        notes: 'Cliente avisa que el pedal vibra un poco',
        estimated_duration_minutes: 75
      },
      start_at: '2026-10-15T09:30:00Z',
      end_at: '2026-10-15T10:45:00Z',
      status: 'confirmed',
      confirmation_evidence_ref: 'ev_rec_call_8831',
      version: 2,
      customer_name: 'Mikel Iturbe',
      vehicle_plate: '1234-BBB',
      origin: 'voice_phone'
    };

    const cachedCustomer: WorkshopCustomer = {
      id: 'c1111111-2222-3333-4444-555555555555',
      tenant_id: '11111111-2222-3333-4444-555555555555',
      workshop_id: '99999999-8888-7777-6666-555555555555',
      name: 'Mikel Iturbe',
      phone: '+34600112233',
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z'
    };

    const cachedVehicle: WorkshopVehicle = {
      id: 'v1111111-2222-3333-4444-555555555555',
      tenant_id: '11111111-2222-3333-4444-555555555555',
      workshop_id: '99999999-8888-7777-6666-555555555555',
      customer_id: 'c1111111-2222-3333-4444-555555555555',
      plate: '1234-BBB',
      make: 'Volkswagen',
      model: 'Golf VII 2.0 TDI',
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z'
    };

    it('correctly maps canonical backend appointment into presentation structure', () => {
      const presentation = formatAppointmentForPresentation(rawAppointment, cachedCustomer, cachedVehicle);

      expect(presentation.id).toBe(rawAppointment.id);
      expect(presentation.customerName).toBe('Mikel Iturbe');
      expect(presentation.customerPhone).toBe('+34600112233');
      expect(presentation.vehiclePlate).toBe('1234-BBB');
      expect(presentation.vehicleInfo).toBe('Volkswagen Golf VII 2.0 TDI');
      expect(presentation.serviceTitle).toBe('Cambio de pastillas delanteras y revisión');
      expect(presentation.symptoms).toEqual(['Ruido metálico al frenar']);
      expect(presentation.durationMinutes).toBe(75);
      expect(presentation.status).toBe('confirmed');
      expect(presentation.source).toBe('voice_phone');
    });

    it('never leaks internal UUIDs or hashes to user-facing display fields', () => {
      const presentation = formatAppointmentForPresentation(rawAppointment, cachedCustomer, cachedVehicle);

      const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

      // Observable customer & vehicle user-facing presentation fields
      expect(UUID_REGEX.test(presentation.customerName)).toBe(false);
      expect(UUID_REGEX.test(presentation.vehiclePlate)).toBe(false);
      expect(UUID_REGEX.test(presentation.vehicleInfo || '')).toBe(false);
      expect(UUID_REGEX.test(presentation.serviceTitle)).toBe(false);
      expect(UUID_REGEX.test(presentation.timeStr)).toBe(false);
      expect(UUID_REGEX.test(presentation.endStr)).toBe(false);
      presentation.symptoms.forEach(sym => {
        expect(UUID_REGEX.test(sym)).toBe(false);
      });
    });

    it('gracefully handles missing customer/vehicle directory data without breaking card hierarchy', () => {
      const isolatedAppointment: WorkshopAppointmentResponse = {
        ...rawAppointment,
        customer_name: '',
        vehicle_plate: '',
        service_request: {}
      };

      const fallbackPresentation = formatAppointmentForPresentation(isolatedAppointment);

      expect(fallbackPresentation.customerName).toBe('Cliente Verificado');
      expect(fallbackPresentation.vehiclePlate).toBe('—');
      expect(fallbackPresentation.vehicleInfo).toBeNull();
      expect(fallbackPresentation.serviceTitle).toBe('Intervención de Taller');
    });
  });
});
