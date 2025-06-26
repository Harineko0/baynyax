import {Hono} from "hono";
import {serve} from "@hono/node-server";
import {createNodeWebSocket} from "@hono/node-ws";
import env from "./env";
import {logger} from "./routes/middleware/logger";
import {GoogleGenAI, LiveServerMessage, Modality} from "@google/genai";
import {AudioEncoder} from "./websocket/audio-encoder";
import {convertAudioBufferToBase64} from "./shared/audio";

const app = new Hono();

const {injectWebSocket, upgradeWebSocket} = createNodeWebSocket({app})

app.use(logger);
app.get(
    '/ws',
    upgradeWebSocket(async (c) => {
        const onMessageCallbacks = new Array<(e: LiveServerMessage) => void>();

        const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
        const session = await ai.live.connect({
            model: "gemini-2.5-flash-preview-native-audio-dialog",
            callbacks: {
                onopen: () => console.log('[GenAI] Connection opened.'),
                onmessage: (message) => {
                    for (const callback of onMessageCallbacks) {
                        callback(message);
                    }
                },
                onerror: (e) => console.error('[GenAI] Error:', e.message),
                onclose: (e) => console.log('[GenAI] Connection closed:', e.reason),
            },
            config: {
                responseModalities: [Modality.AUDIO],
                systemInstruction: "You are a helpful assistant and answer in a friendly tone.",
            },
        });

        const receivedAudio = new AudioEncoder((buf) => {
            session.sendRealtimeInput(
                {
                    audio: {
                        data: convertAudioBufferToBase64(buf),
                        mimeType: "audio/pcm;rate=16000"
                    }
                }

            )
        });

        return {
            onOpen: (evt, ws) => {
                onMessageCallbacks.push((message) => {
                    if (message.data) {
                        ws.send(Buffer.from(message.data, 'base64'));
                    }
                })
            },
            onMessage: (event, ws) => {
                const {data} = event;

                if (typeof data === 'string') {
                    console.log(`Received string data: ${data}.`);
                    // TODO: Send to GenAI
                } else {
                    // Blob or ArrayBuffer
                    receivedAudio.append(data);
                }
            },
            onClose: () => {
                console.log('Connection closed')
                session.close();
            },
            onError: (error, ws) => {
                console.error('WebSocket error:', error);
                ws.close();
                session.close();
            },
        }
    })
)

const server = serve({
    fetch: app.fetch,
    port: env.PORT,
});
injectWebSocket(server);
console.log("Server started" + (env.NODE_ENV === 'development' ? ` at http://localhost:${env.PORT}` : ''));
