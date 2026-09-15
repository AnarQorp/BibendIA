export type NavSection = 
  | 'midia' 
  | 'bandeja' 
  | 'agenda' 
  | 'presupuestos' 
  | 'seguimientos' 
  | 'impacto' 
  | 'integraciones';

export interface Vehicle {
  id: string;
  plate: string; // e.g. "8421 LMK"
  brand: string; // e.g. "SEAT"
  model: string; // e.g. "León 1.5 TSI"
  year: number;
  kilometers: number;
  motorization: string; // e.g. "1.5 TSI 130 CV"
  vin?: string;
  lastServiceDate?: string;
  futureRecommendation?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatarUrl?: string;
  notes?: string;
}

export interface Message {
  id: string;
  channel: 'whatsapp' | 'phone' | 'web' | 'sms';
  sender: 'client' | 'ai' | 'workshop';
  senderName: string;
  content: string;
  timestamp: string;
}

export interface AiInterpretation {
  detectedNeeds: string[];
  missingInfo: string[];
  recommendedAction: string;
  suggestedSlots?: { date: string; time: string; label: string }[];
  suggestedQuote?: {
    serviceName: string;
    parts: { name: string; price: number }[];
    laborHours: number;
    laborRate: number;
  };
}

export interface Conversation {
  id: string;
  customerId: string;
  vehicleId: string;
  channel: 'whatsapp' | 'phone' | 'web' | 'sms';
  status: 'needs_attention' | 'ai_handling' | 'resolved';
  unread: boolean;
  lastUpdate: string;
  messages: Message[];
  aiInterpretation: AiInterpretation;
}

export interface Appointment {
  id: string;
  customerId: string;
  vehicleId: string;
  serviceName: string;
  estimatedDurationMinutes: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: 'scheduled' | 'in_progress' | 'completed' | 'sent_to_dms';
  assignedMechanic?: 'Jon' | 'Iker';
  aiCreated: boolean;
  completedNotes?: string;
  futureRecommendation?: string;
}

export interface QuoteItem {
  id: string;
  category: 'part' | 'labor';
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Quote {
  id: string;
  number: string; // e.g. "PRE-2026-084"
  customerId: string;
  vehicleId: string;
  title: string;
  createdDate: string;
  status: 'ai_prepared' | 'pending_approval' | 'sent' | 'accepted' | 'rejected';
  items: QuoteItem[];
  subtotal: number;
  tax: number; // 21% IVA
  total: number;
  estimatedLaborHours: number;
  aiRationale: string;
}

export interface FollowUpOpportunity {
  id: string;
  customerId: string;
  vehicleId: string;
  type: 'unanswered_quote' | 'upcoming_maintenance' | 'recommended_repair' | 'dormant_client';
  title: string;
  description: string;
  daysPending: number;
  potentialValue: number;
  suggestedMessage: string;
  status: 'pending' | 'sent' | 'converted' | 'dismissed';
}

export interface AiImpactLog {
  id: string;
  timestamp: string; // HH:mm or Date string
  title: string;
  details: string;
  category: 'reception' | 'booking' | 'quote' | 'followup' | 'billing';
  timeSavedMinutes: number;
  revenueImpact?: number;
}
