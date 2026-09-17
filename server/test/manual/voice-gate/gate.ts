import * as VapiModule from '@vapi-ai/web';
import { Conversation } from '@elevenlabs/client';

const params = new URLSearchParams(location.search);
const provider = params.get('provider');
const status = document.querySelector<HTMLPreElement>('#status')!;
const events = document.querySelector<HTMLPreElement>('#events')!;
const log = (type: string, detail: unknown = {}) => {
  events.textContent += `${JSON.stringify({ at: new Date().toISOString(), type, detail })}\n`;
};
window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
  status.textContent = `error:${message}`;
  log('unhandledrejection', { message });
});

const prompt = `Eres la recepcionista de pruebas de BibendIA para un taller español. Habla siempre en español de España, con frases breves. Esta sesión es TEST ONLY y no produce efectos reales. Debes: obtener nombre, matrícula, necesidad y fecha; leer la matrícula para confirmarla; si el usuario cambia de fecha, conservar sólo la última; no declarar una cita confirmada hasta oír una confirmación explícita; ante fallo de herramienta o solicitud de humano, explicar que transfieres. Los huecos de prueba son martes 22 a las 10:00, viernes 25 a las 09:00, lunes 28 a las 11:00. Al final resume nombre, matrícula, necesidad, fecha final y si hubo confirmación explícita. No inventes datos ausentes.`;
const firstMessage = 'Hola, soy la recepción de pruebas de BibendIA. ¿En qué puedo ayudarte?';
// The Vapi package is CommonJS; Vite resolves the runtime default export.
const Vapi = (VapiModule as unknown as { default: new (token: string) => any }).default;

let stop: (() => Promise<void>) | undefined;
document.querySelector('#start')!.addEventListener('click', async () => {
  status.textContent = 'connecting';
  const configResponse = await fetch(`/gate-config?provider=${encodeURIComponent(provider ?? '')}`);
  if (!configResponse.ok) throw new Error(`Gate config failed: ${configResponse.status}`);
  const config = await configResponse.json() as { assistantId: string; token: string };
  const { assistantId, token } = config;
  if (provider === 'vapi') {
    const vapi = new Vapi(token);
    for (const name of ['call-start', 'call-end', 'speech-start', 'speech-end', 'message', 'error'] as const) vapi.on(name, (detail: unknown) => log(name, detail));
    const call = await vapi.start(assistantId, {
      firstMessage,
      firstMessageMode: 'assistant-speaks-first',
      firstMessageInterruptionsEnabled: true,
      model: { provider: 'openai', model: 'gpt-4.1-mini', messages: [{ role: 'system', content: prompt }] },
      transcriber: { provider: 'soniox', model: 'stt-rt-v4', language: 'es' },
    });
    if (!call) throw new Error('Vapi did not create a call');
    status.textContent = `connected:${call.id}`;
    stop = async () => vapi.stop();
  } else if (provider === 'elevenlabs') {
    let providerCallId = '';
    const conversation = await Conversation.startSession({
      signedUrl: token,
      connectionType: 'websocket',
      clientTools: {
        create_bibendia_appointment: async (parameters: Record<string, unknown>) => {
          log('tool-request', { name: 'create_bibendia_appointment', parameters });
          if (!providerCallId) throw new Error('ElevenLabs conversation id is unavailable');
          const response = await fetch('http://127.0.0.1:3100/v1/voice/tools/create-appointment', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              provider: 'elevenlabs',
              externalAccountId: assistantId,
              providerCallId,
              ...parameters,
            }),
          });
          const result = await response.json();
          log('tool-result', { name: 'create_bibendia_appointment', status: response.status, result });
          return JSON.stringify(result);
        },
      },
      onConnect: ({ conversationId }) => {
        providerCallId = conversationId;
        status.textContent = `connected:${conversationId}`;
        log('connect', { conversationId });
      },
      onDisconnect: (detail) => log('disconnect', detail),
      onMessage: (detail) => log('message', detail),
      onError: (detail) => log('error', detail),
      onModeChange: (detail) => log('mode', detail),
    });
    stop = async () => conversation.endSession();
  } else throw new Error('Unknown provider');
});
document.querySelector('#stop')!.addEventListener('click', async () => { await stop?.(); status.textContent = 'stopped'; });
