export const testWorkshopCapacityPolicy = {
  version: 'test-v1',
  liftCount: 10,
  nonLiftBayCount: 10,
  concurrentTechnicians: 10,
  maxVehiclesOnSite: 50,
  maxVehicleIntakesPerHour: 20,
  resourceRequirements: {
    rules: {
      inspection: { mechanic: 1, lift: 0, genericBay: 1 },
      oil_service: { mechanic: 1, lift: 0, genericBay: 0 },
      brakes_or_noise: { mechanic: 1, lift: 1, genericBay: 0 },
      generic_fault: { mechanic: 1, lift: 0, genericBay: 1 },
    },
    fallback: { mechanic: 1, lift: 0, genericBay: 0 },
  },
} as const;
