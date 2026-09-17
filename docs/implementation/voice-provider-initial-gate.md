# VoiceProvider initial gate — Vapi vs ElevenLabs

Date: 2026-09-17
Decision state: initial gate complete; twenty-call phase not started.

## Method

- Five browser voice sessions per provider through the official web SDK.
- One identical 16 kHz mono WAV per scenario, injected as the browser microphone.
- Caller speech generated locally in Spanish; no provider under test generated the caller audio.
- Same system instructions, slots and entity expectations.
- Provider call/conversation records were fetched after each session for duration, transcript and cost.
- This gate is `[TEST ONLY]`: it does not create product appointments.

The five scenarios covered Spanish from Spain, a Basque name and spoken plate, interruption/date change, explicit non-confirmation, a long unstructured request, and request for human transfer. The long scenario exercised turn-taking and noisy/fragmented input, but this run did not add a calibrated acoustic-noise track; acoustic noise remains pending for the next controlled gate.

## PostgreSQL prerequisite

Migration applied successfully. An eight-way concurrent replay produced exactly:

- one appointment;
- one action intent;
- one audit event;
- one outbox event.

The cross-tenant visibility test also passed under the forced-RLS runtime role.

## Vapi results

| Scenario | Result |
|---|---|
| Basque name / plate | Plate, service and date correct; `Aitor Etxeberria` became `Héctor Echeverria`. |
| Interruption / date change | Correctly retained Friday after rejecting Thursday; opening need/name was transcribed as Japanese garbage. |
| No confirmation | Did not claim a confirmed appointment, but most caller speech was transcribed as Italian-like text. |
| Long / unstructured | Correct plate and final date; invented/corrupted name and several phrases; partial final response. |
| Human transfer request | Caller speech was transcribed as Cyrillic/Slavic text; transfer intent was not understood. |

Provider artifacts existed for all five calls. Total observed duration was 231.802 seconds. Total provider-reported cost was **$0.2469**, or **$0.0639/minute** for this sample.

Call IDs:

- `01a0aec4-d0d5-7886-9597-3485d1e572c6`
- `01a0aec5-be48-7aa0-b8b9-c6a9131c4333`
- `01a0aec6-ad1b-7992-be0b-e43f58f1a0b0`
- `01a0aec7-44a9-7992-be0f-0b096568f335`
- `01a0aec8-5fe6-7777-9731-c1a0642c102b`

## ElevenLabs results

| Scenario | Result |
|---|---|
| Basque name / plate | Plate, service, date and confirmation correct; `Etxeberria` normalized to `Echeverría`. |
| Interruption / date change | Correctly rejected Thursday and retained Friday 25 at 09:00; requested missing identity data instead of closing. |
| No confirmation | Explicitly stated that it would not confirm and preserved the tentative nature of Tuesday. |
| Long / unstructured | Correct plate, final date and no-repair-without-notice constraint; one incorrect “medical advice” classification. |
| Human transfer request | Understood liquid loss and human request; verbally announced transfer but no real transfer tool existed. |

Provider artifacts existed for all five conversations. Total observed duration was 240 seconds. Provider metadata reported **$0.296713 fiat cost**, **2,982 credits**, or **$0.07418/minute** for this sample.

Conversation IDs:

- `conv_5301m2qchkwzedy9waztc3pz9t2t`
- `conv_0701m2qckczten2r55xatzherpk3`
- `conv_1801m2qcn64yegd8abhe6b07yt2e`
- `conv_1501m2qcpa3afzravhkp9wv5hzgn`
- `conv_1901m2qcrenfe659nrkaka5kx779`

## Failures and gate interpretation

- Neither provider was allowed to write product state in this voice-quality gate.
- No duplicate or unconfirmed appointment was created.
- Real tool schema validity, external receipt verification and real transfer are **not passed**: neither remote agent had production tools attached.
- ElevenLabs' transfer wording was too strong for an unavailable tool and must be changed to an honest fallback before pilot use.
- The synthetic track began while each provider delivered its first message. This intentionally exercised interruption, but caused the first utterance to be missed or reordered in several sessions. ElevenLabs recovered materially better.
- Exact response latency is not scored from this run because fixed prerecorded timing and first-message overlap would make it misleading.

## Recommendation

Select **ElevenLabs as the provisional VoiceProvider for Vertical Slice 01**. It costs approximately 16% more per observed minute in this small sample, but its Spanish ASR, date-change handling, explicit-confirmation discipline and recovery from fragmented input were materially stronger. Vapi's lower cost does not compensate for catastrophic transcription failures in two safety-relevant scenarios.

Do not begin the twenty-call phase yet. First connect the real BibendIA tools/receipts and truthful human-fallback behavior to ElevenLabs, run one end-to-end web call into PostgreSQL, and add calibrated workshop noise. Retain Vapi behind the same port as the fallback candidate; its adapter remains valuable and can be retested after ASR/turn configuration changes.
