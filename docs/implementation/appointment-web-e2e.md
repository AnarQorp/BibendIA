# Vertical Slice 01 — ElevenLabs web appointment E2E

Date: 2026-09-17

Status: **PASS for the web-channel increment**. This is not a PSTN or production-pilot pass.

## Scope exercised

`ElevenLabs web conversation → client tool → Agent Core → Policy (pilot_supervised) → SchedulingPort → PostgreSQL transaction → receipt → verbal confirmation`

No Google Calendar, PSTN, WhatsApp, Lara, parts, quotes, n8n, mobile work, or 20-call gate was started.

## Successful E2E evidence

- Provider conversation: `conv_7501m2qf8w6rfrar24qgjwsf1grx`
- Duration: 95 seconds
- Observed ElevenLabs charge: 1,224 credits / USD 0.121904
- Tool invocations/results: 1 / 1
- Call: `2ed96c4b-450c-4f62-bf6e-2e336387d74e`
- Conversation: `ddf35e3d-ef3c-4f61-bd2b-57a6e7c8f722`
- ReceptionCase: `f34bddbd-2adc-4518-8e24-65f3bda12c84`
- ActionIntent: `0e18bd87-cadb-480d-b1db-b9e2c8c93bec` (`succeeded`)
- Appointment: `5fcf3d32-34fb-494f-ab81-fd952029581f` (`confirmed`)
- Audit event: `5` (`appointment_created`)
- Outbox event: `4` (`appointment.created`, pending worker publication)
- Receipt evidence: `postgres:appointment:5fcf3d32-34fb-494f-ab81-fd952029581f`
- Confirmation evidence: `voice:2ed96c4b-450c-4f62-bf6e-2e336387d74e:explicit-confirmation`

The agent called the tool only after the customer said: “Sí, confirmo explícitamente la cita del martes veintidós de septiembre a las diez.” The tool returned `ok=true`, `receipt.outcome=succeeded`, and an evidence reference before the agent verbally said that the appointment was confirmed.

The appointment retains the domain payload: `service_request`, symptoms, estimated duration (60 minutes), and mechanic capacity requirement. It is not modelled as a Calendar event.

## Identity resolution

The caller said `Aitor Echeverría`; PostgreSQL already contained `Aitor Etxeberria`. Resolution used the strong, normalized plate identifier `1489 KMR`, linked to the existing customer and vehicle. No fuzzy name match and no duplicate customer were created. The name variation is recorded as audit evidence.

If the plate does not resolve uniquely, the tool returns `IDENTITY_AMBIGUOUS`, creates no customer, and requests human attention instead of guessing. This is covered by a PostgreSQL integration test.

## Replay result

The identical provider event was submitted twice after the successful call. Both replays returned the same appointment ID and evidence reference. Database counts for its idempotency key remained:

- appointments: 1
- action intents: 1
- calls: 1
- `appointment_created` audit events: 1
- `appointment.created` outbox events: 1

## Acoustic regression

The checked-in generator `server/test/manual/voice-gate/add-workshop-noise.ts` adds deterministic workshop-like machinery hum, broadband noise, and periodic tool bursts.

- Seed: `42017`
- Target SNR: 12.0 dB
- Measured SNR: 12.00018 dB
- Provider conversation: `conv_5301m2qfse99ftsbg1phtabwp4sq`
- Duration: 92 seconds
- Observed ElevenLabs charge: 1,113 credits / USD 0.110759

At 12 dB SNR, ElevenLabs correctly captured the name, plate, requested service, and start-up noise symptom. The caller explicitly withheld confirmation and asked for a person. No client tool ran and no appointment was created.

The first acoustic run exposed an unsafe phrase promising a future callback. The agent prompt was corrected. The regression response now states that this channel cannot transfer or guarantee a callback and recommends direct workshop contact; it makes no external-success claim.

## Failure found and fixed

The first real tool execution found a PostgreSQL bind-count defect in the identity-variant audit insert (five placeholders, four values). PostgreSQL rolled the transaction back, the API returned failure, the agent did not claim success, and no appointment was created. The missing tenant parameter was added and the successful E2E above was then run.

Two earlier audio-timing attempts ended before the recorded confirmation was delivered; neither called the tool or mutated PostgreSQL. The harness audio was lengthened before the successful run.

## Verification

- Unit suites: 6 files / 11 tests PASS
- PostgreSQL integration suites: 2 files / 4 tests PASS
- Strong-identity variant, ambiguous identity, replay/concurrency, and cross-tenant RLS are covered
- Frontend production build: PASS
- `git diff --check`: PASS
