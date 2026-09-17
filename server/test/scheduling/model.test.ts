import { describe, expect, it } from 'vitest';
import type { ServiceRequest } from '../../src/modules/scheduling/model.js';

describe('scheduling service request', () => {
  it('retains operational detail instead of collapsing to a calendar event', () => {
    const request: ServiceRequest = {
      intent: 'brakes_or_noise',
      symptoms: ['ruido metálico al frenar en frío'],
      notes: 'No sustituir piezas sin avisar',
      estimatedDurationMinutes: 60,
      capacityRequirements: [{ resourceType: 'mechanic', quantity: 1, requiredSkills: ['brakes'] }],
    };

    expect(request.symptoms).toHaveLength(1);
    expect(request.estimatedDurationMinutes).toBe(60);
    expect(request.capacityRequirements[0].requiredSkills).toContain('brakes');
  });
});
