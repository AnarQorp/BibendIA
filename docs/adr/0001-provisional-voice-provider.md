# ADR 0001: Provisional VoiceProvider for Vertical Slice 01

- Status: Accepted — provisional
- Date: 2026-09-17
- Decision owner: BibendIA engineering pilot

## Context

Vertical Slice 01 requires a provider-neutral voice boundary and a real appointment flow whose authority remains in BibendIA/PostgreSQL. Vapi and ElevenLabs were exercised through the same staged web gate. Both adapters must remain replaceable because the later PSTN and 20-call gates have not run.

The initial five-session gate found critical transcription corruption in Vapi on several Spanish inputs. ElevenLabs was more reliable on the tested Spanish conversation, plate, date change, no-confirmation, and long/fragmented cases. ElevenLabs subsequently completed the real web E2E through the BibendIA client tool and received a verifiable PostgreSQL receipt before verbally confirming success.

## Decision

Use **ElevenLabs as the provisional `VoiceProvider` for Vertical Slice 01**.

Keep **Vapi as an implemented alternative adapter behind the same `VoiceProvider` port**. No domain, scheduling, policy, audit, or persistence code may depend on ElevenLabs-specific payloads.

Provider events resolve tenant/workshop from server-side channel bindings. The voice model may interpret conversation and request tools, but it does not own state transitions, authorization, idempotency, or truth about external effects.

## Mandatory invariants

- PostgreSQL is the appointment authority.
- `pilot_supervised` is enforced through the normal Policy/Approvals path.
- Appointment success may be spoken only after `receipt.outcome=succeeded` with a non-empty evidence reference.
- The create-appointment idempotency key is derived from provider and provider call ID.
- Identity resolution uses strong identifiers such as normalized plate/phone. A name variation alone never authorizes fuzzy matching or automatic customer creation.
- If transfer or callback infrastructure does not exist, the agent must not claim it does.
- Calendar remains a later projection, not the appointment domain model.

## Evidence

- Initial provider gate: `docs/implementation/voice-provider-initial-gate.md`
- Successful real-tool web E2E: `docs/implementation/appointment-web-e2e.md`
- Successful provider conversation: `conv_7501m2qf8w6rfrar24qgjwsf1grx`
- Persisted appointment: `5fcf3d32-34fb-494f-ab81-fd952029581f`

## Consequences

- New voice work targets the ElevenLabs adapter first while preserving port parity.
- Vapi remains available for a later controlled continuation of the bake-off.
- This ADR does not approve PSTN activation, the 20-call gate, production routing, or any P2 integration.

## Revisit gates

Re-evaluate the decision after:

1. a real PSTN call with correlated CDR/call ID and PostgreSQL evidence;
2. validated failover/kill-switch behavior;
3. the authorized 20-call comparable gate, if both candidates continue;
4. materially different cost, latency, Spanish transcription, or operational reliability evidence.
