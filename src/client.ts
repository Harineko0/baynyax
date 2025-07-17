import WebSocket from 'ws';

//=========================================================
// --- 設定項目 ---
//=========================================================
const SERVER_URL = 'ws://localhost:3000/ws';

// --- 通信プロトコル定義 (サーバーと同一) ---
const C2S_MSG_TYPE_AUDIO = 0x01;
const C2S_MSG_TYPE_VIDEO = 0x03;
const C2S_MSG_TYPE_HB = 0x04;

const S2C_MSG_TYPE_AUDIO = 0x83;

// --- エミュレーション設定 ---
const AUDIO_INTERVAL_MS = 200;    // ダミー音声データを送信する間隔
const VIDEO_INTERVAL_MS = 1000;   // ダミー映像データを送信する間隔
const HEARTBEAT_INTERVAL_MS = 10000; // ハートビートを送信する間隔

const AUDIO_CHUNK_SIZE = 512;     // ダミー音声データのサイズ
const VIDEO_FRAME_SIZE = 8192;    // ダミー映像データのサイズ

//=========================================================
// --- ヘルパー関数 ---
//=========================================================

/**
 * プロトコルに従ったバイナリパケットを作成する
 * @param type メッセージタイプ
 * @param payload 送信するデータ
 * @returns ヘッダーとペイロードが結合されたBuffer
 */
function createPacket(type: number, payload: Buffer): Buffer {
    const header = Buffer.alloc(3);
    header.writeUInt8(type, 0);
    header.writeUInt16LE(payload.length, 1);
    return Buffer.concat([header, payload]);
}

//=========================================================
// --- メイン処理 ---
//=========================================================

console.log(`Connecting to server at ${SERVER_URL}...`);
const ws = new WebSocket(SERVER_URL);

const intervalIds: NodeJS.Timeout[] = [];

ws.on('open', () => {
    console.log('✅ Connection successful! Starting data emulation...');

    // 1. 定期的にダミー音声データを送信
    const audioInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            const dummyAudio = Buffer.alloc(AUDIO_CHUNK_SIZE, Math.random() * 255);
            const packet = createPacket(C2S_MSG_TYPE_AUDIO, dummyAudio);
            ws.send(packet);
            console.log(`🎤 Sent audio packet (${packet.length} bytes)`);
        }
    }, AUDIO_INTERVAL_MS);
    intervalIds.push(audioInterval);

    // 2. 定期的にダミー映像データを送信
    const videoInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            const dummyVideo = Buffer.from(`Fake JPEG data, size: ${VIDEO_FRAME_SIZE}`);
            const packet = createPacket(C2S_MSG_TYPE_VIDEO, dummyVideo);
            ws.send(packet);
            console.log(`📹 Sent video packet (${packet.length} bytes)`);
        }
    }, VIDEO_INTERVAL_MS);
    intervalIds.push(videoInterval);

    // 3. 定期的にハートビートを送信
    const heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            const packet = createPacket(C2S_MSG_TYPE_HB, Buffer.alloc(0));
            ws.send(packet);
            console.log(`❤️  Sent heartbeat`);
        }
    }, HEARTBEAT_INTERVAL_MS);
    intervalIds.push(heartbeatInterval);
});

ws.on('message', (data: Buffer) => {
    // サーバーからのメッセージをパース
    if (data instanceof Buffer && data.length >= 3) {
        const type = data.readUInt8(0);
        const length = data.readUInt16LE(1);
        const payload = data.subarray(3);

        if (type === S2C_MSG_TYPE_AUDIO) {
            console.log(`🤖 Received AI audio chunk from server (${payload.length} bytes)`);
        } else {
            console.warn(`⚠️ Received unknown packet type: 0x${type.toString(16)}`);
        }
    }
});

ws.on('close', (code, reason) => {
    console.log(`❌ Connection closed. Code: ${code}, Reason: ${reason}`);
    // すべての定期実行を停止
    intervalIds.forEach(clearInterval);
});

ws.on('error', (err) => {
    console.error('🔥 WebSocket error:', err.message);
    // すべての定期実行を停止
    intervalIds.forEach(clearInterval);
});