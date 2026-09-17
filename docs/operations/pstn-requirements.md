# PSTN requirements for the voice bake-off

## Required service

- One Spanish `+34` DID in E.164 format with inbound voice.
- The number must support either a provider-native import (for example Twilio) or standards-based SIP trunk routing.
- Caller ID must be forwarded intact so BibendIA can search a customer only after tenant resolution by the called endpoint.
- Call detail records and stable provider call IDs must be exportable.
- The route must support transfer to the workshop/human fallback; SIP `REFER` support is preferred.
- For SIP: TLS signalling on 5061, SRTP where supported, digest authentication, and G.711 or G.722 audio.
- A configurable failover/disable route must send calls back to the workshop if the agent is unhealthy.

## Can one number be reused?

Yes, sequentially. The same DID can be repointed between Vapi and ElevenLabs, which also keeps the caller-facing number constant during the bake-off. A single ordinary number cannot normally terminate at both native provider configurations simultaneously.

For simultaneous A/B routing, use either:

1. two DIDs; or
2. one DID terminating on a controllable SIP proxy/PBX/SBC that routes each call to the selected provider.

The pilot should start with sequential reuse. It is cheaper and sufficient for the controlled 5-call gate and 20-call comparison. Do not purchase two numbers unless parallel live traffic becomes a requirement.
