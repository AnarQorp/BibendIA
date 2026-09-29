import { describe, expect, it } from 'vitest';
import { appointmentToolInput } from '../../src/modules/agent-core/appointment-tool.js';

const valid = {
  providerCallId: 'conv_test', customerName: 'Aketza', plate: '1234 ABC',
  serviceIntent: 'inspection', symptoms: ['revisión'], estimatedDurationMinutes: 60,
  slotToken: 'slot-test', explicitConfirmation: true, confirmationTranscript: 'Sí',
};

describe('appointment confirmation evidence contract', () => {
  it('accepts and preserves a short literal confirmation', () => {
    expect(appointmentToolInput.parse(valid).confirmationTranscript).toBe('Sí');
  });

  it('rejects an empty or whitespace-only transcript', () => {
    expect(appointmentToolInput.safeParse({ ...valid, confirmationTranscript: '' }).success).toBe(false);
    expect(appointmentToolInput.safeParse({ ...valid, confirmationTranscript: '   ' }).success).toBe(false);
  });
});
