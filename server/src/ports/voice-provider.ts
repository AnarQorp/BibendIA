import type { CallId, TenantContext } from '../domain/ids.js';

export type VoiceProviderName = 'vapi' | 'elevenlabs';

export interface VoiceSessionRequest {
  tenant: TenantContext;
  providerCallId: string;
  calledEndpoint: string;
  allowedTools: string[];
}

export interface VoiceCallArtifacts {
  providerCallId: string;
  transcriptRef?: string;
  recordingRef?: string;
  providerEvidenceRef: string;
}

export interface VoiceProvider {
  readonly name: VoiceProviderName;
  acceptInbound(request: VoiceSessionRequest): Promise<{ callId: CallId }>;
  configureSession(callId: CallId, request: VoiceSessionRequest): Promise<void>;
  transfer(callId: CallId, destination: string, reason: string): Promise<void>;
  end(callId: CallId): Promise<void>;
  getArtifacts(callId: CallId): Promise<VoiceCallArtifacts>;
}
