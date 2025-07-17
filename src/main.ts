import {Hono} from "hono";
import {serve} from "@hono/node-server";
import {createNodeWebSocket} from "@hono/node-ws";
import env from "./env";
import {logger} from "./routes/middleware/logger";
import {GoogleGenAI, LiveServerMessage, Modality} from "@google/genai";

//=========================================================
// --- 通信プロトコル定義 ---
//================================G=========================
const C2S_MSG_TYPE_AUDIO = 0x01;
const C2S_MSG_TYPE_META = 0x02;
const C2S_MSG_TYPE_VIDEO = 0x03;
const C2S_MSG_TYPE_HB = 0x04;

const S2C_MSG_TYPE_AUDIO = 0x83;

//=========================================================
// --- GenAI セッション管理モジュール ---
//=========================================================

/**
 * Google GenAIとのリアルタイムセッションをセットアップし、管理する
 * @param onAiMessage - AIからメッセージを受信したときのコールバック関数
 * @returns セッションを操作するためのオブジェクト
 */
async function setupGenAISession(
    onAiMessage: (message: LiveServerMessage) => void
) {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const session = await ai.live.connect({
        model: 'gemini-2.5-flash-preview-native-audio-dialog',
        callbacks: {
            onopen: () => console.log('[GenAI] Session opened.'),
            onmessage: onAiMessage,
            onerror: (e) => console.error('[GenAI] Error:', e.message),
            onclose: (e) => console.log('[GenAI] Session closed:', e.reason),
        },
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: 'You are a helpful assistant and answer in a friendly tone.',
        },
    });

    return {
        /**
         * AIセッションにリアルタイムデータを送信する
         * @param data - 送信するデータ（音声または映像）
         */
        send: (data: { audio?: any; video?: any }) => {
            session.sendRealtimeInput(data);
        },
        /**
         * AIセッションを閉じる
         */
        close: () => {
            session.close();
        },
    };
}

//=========================================================
// --- Hono サーバーアプリケーション ---
//=========================================================

const app = new Hono();
const {injectWebSocket, upgradeWebSocket} = createNodeWebSocket({app})
app.use(logger);
app.get(
    '/ws',
    upgradeWebSocket(async (c) => {
        // GenAIセッションを格納する変数
        let genAI: Awaited<ReturnType<typeof setupGenAISession>> | null = null;

        return {
            onOpen: async (evt, ws) => {
                console.log('[WS] Connection opened.');

                // AIからのメッセージをクライアントに転送するコールバックを定義
                const onAiMessageHandler = (message: LiveServerMessage) => {
                    if (message.data) {
                        // Base64でエンコードされたAIの音声データをBufferにデコード
                        const audioChunk = Buffer.from(message.data, 'base64');

                        // プロトコルに従ってヘッダーを作成 [Type (1B)] + [Length (2B)]
                        const header = Buffer.alloc(3);
                        header.writeUInt8(S2C_MSG_TYPE_AUDIO, 0);
                        header.writeUInt16LE(audioChunk.length, 1);

                        // ヘッダーとペイロードを結合してクライアントに送信
                        ws.send(Buffer.concat([header, audioChunk]));
                    }
                };

                // GenAIセッションをセットアップ
                try {
                    genAI = await setupGenAISession(onAiMessageHandler);
                } catch (error) {
                    console.error('[WS] Failed to setup GenAI session:', error);
                    ws.close(1011, 'AI session setup failed');
                }
            },
            onMessage: (evt, ws) => {
                if (!genAI) return;

                const { data } = evt;

                // ESP32からのバイナリデータのみを処理
                if (data instanceof Buffer && data.length >= 3) {
                    // プロトコルヘッダーをパース
                    const type = data.readUInt8(0);
                    const length = data.readUInt16LE(1);
                    const payload = data.subarray(3);

                    // ペイロードの長さがヘッダーの示す長さと一致するか確認
                    if (payload.length !== length) {
                        console.warn('[WS] Malformed packet: length mismatch.');
                        return;
                    }

                    // メッセージタイプに応じてAIにデータを転送
                    switch (type) {
                        case C2S_MSG_TYPE_AUDIO:
                            genAI.send({
                                audio: {
                                    data: payload.toString('base64'),
                                    // ESP32のサンプリングレートに合わせて設定
                                    mimeType: 'audio/pcm;rate=8000',
                                },
                            });
                            break;

                        case C2S_MSG_TYPE_VIDEO:
                            genAI.send({
                                video: {
                                    data: payload.toString('base64'),
                                    // ESP32が送信する形式
                                    mimeType: 'image/jpeg',
                                },
                            });
                            break;

                        case C2S_MSG_TYPE_META:
                            console.log(`[WS] Metadata received: ${payload.toString()}`);
                            break;

                        case C2S_MSG_TYPE_HB:
                            console.log('[WS] Heartbeat received.');
                            break;
                    }
                }
            },
            onClose: () => {
                console.log('[WS] Connection closed.');
                // GenAIセッションも閉じる
                if (genAI) {
                    genAI.close();
                }
            },
            onError: (err, ws) => {
                console.error('[WS] Error:', err);
                // GenAIセッションも閉じる
                if (genAI) {
                    genAI.close();
                }
            },
        };
    })
);

const server = serve({
    fetch: app.fetch,
    port: env.PORT || 3000,
}, (info) => {
    console.log(`Server listening on http://localhost:${info.port}`);
});
injectWebSocket(server);
