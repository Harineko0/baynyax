// Test file: https://storage.googleapis.com/generativeai-downloads/data/16000.wav
import {GoogleGenAI, LiveServerMessage, Modality} from '@google/genai';
import * as fs from "node:fs";
import { WaveFile } from 'wavefile';

const ai = new GoogleGenAI({ apiKey: "API_KEY" });

async function live() {
    const responseQueue = new Array<LiveServerMessage>();

    async function waitMessage() {
        let done = false;
        let message: LiveServerMessage | undefined = undefined;
        while (!done) {
            message = responseQueue.shift();
            if (message) {
                done = true;
            } else {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }
        return message;
    }

    async function handleTurn() {
        const turns = new Array<LiveServerMessage>();
        let done = false;
        while (!done) {
            const message = await waitMessage();
            if (!message) {
                console.debug('No message received, waiting...');
                continue;
            }
            turns.push(message);
            if (message.serverContent && message.serverContent.turnComplete) {
                done = true;
            }
        }
        return turns;
    }

    const session = await ai.live.connect({
        model: "gemini-2.5-flash-preview-native-audio-dialog",
        callbacks: {
            onopen: () => {
                console.debug('Opened');
            },
            onmessage: (message) => {
                responseQueue.push(message);
            },
            onerror: (e) => {
                console.debug('Error:', e.message);
            },
            onclose: (e) => {
                console.debug('Close:', e.reason);
            },
        },
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: "You are a helpful assistant and answer in a friendly tone."
        },
    });

    // Send Audio Chunk
    const fileBuffer = fs.readFileSync("sample.wav");

    // Ensure audio conforms to API requirements (16-bit PCM, 16kHz, mono)
    const wav = new WaveFile();
    wav.fromBuffer(fileBuffer);
    wav.toSampleRate(16000);
    wav.toBitDepth("16");
    const base64Audio = wav.toBase64();

    // If already in correct format, you can use this:
    // const fileBuffer = fs.readFileSync("sample.pcm");
    // const base64Audio = Buffer.from(fileBuffer).toString('base64');

    session.sendRealtimeInput(
        {
            audio: {
                data: base64Audio,
                mimeType: "audio/pcm;rate=16000"
            }
        }

    );

    const turns = await handleTurn();

    // Combine audio data strings and save as wave file
    const combinedAudio = turns.reduce((acc, turn) => {
        if (turn.data) {
            const buffer = Buffer.from(turn.data, 'base64');
            const intArray = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Int16Array.BYTES_PER_ELEMENT);
            return acc.concat(Array.from(intArray));
        }
        return acc;
    }, new Array<number>());

    const audioBuffer = new Int16Array(combinedAudio);

    const wf = new WaveFile();
    wf.fromScratch(1, 24000, '16', audioBuffer);  // output is 24kHz
    fs.writeFileSync('audio.wav', wf.toBuffer());

    session.close();
}

async function main() {
    await live().catch((e) => console.error('got error', e));
}

main();

