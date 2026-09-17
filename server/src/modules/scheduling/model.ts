import type { AppointmentId, ReceptionCaseId, TenantId, WorkshopId } from '../../domain/ids.js';

export interface ServiceRequest {
  intent: 'inspection' | 'oil_service' | 'brakes_or_noise' | 'generic_fault';
  symptoms: string[];
  notes?: string;
  estimatedDurationMinutes: number;
  capacityRequirements: CapacityRequirement[];
}

export interface CapacityRequirement {
  resourceType: 'mechanic' | 'lift' | 'diagnostic_bay' | 'generic_bay';
  quantity: number;
  requiredSkills?: string[];
}

export interface Appointment {
  id: AppointmentId;
  tenantId: TenantId;
  workshopId: WorkshopId;
  caseId: ReceptionCaseId;
  customerId: string;
  vehicleId: string;
  serviceRequest: ServiceRequest;
  startAt: string;
  endAt: string;
  status: 'tentative' | 'held' | 'confirmed' | 'cancelled';
  confirmationEvidenceRef?: string;
  version: number;
}

export interface AppointmentSlot {
  token: string;
  workshopId: WorkshopId;
  startAt: string;
  endAt: string;
  capacity: CapacityRequirement[];
  expiresAt: string;
}
