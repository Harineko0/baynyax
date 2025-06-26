import {AppConfig} from "../env";
import {isSilent} from "./silenceDetector";

type RecordingCallback = (speechData: Buffer) => void;

export class AudioEncoder {
    private audioBuffer: Buffer = Buffer.alloc(0);
    private silentChunkCount = 0;
    private readonly maxSilentChunks = AppConfig.SILENCE_DURATION_MS / AppConfig.CHUNK_DURATION_MS;

    public constructor(
        private readonly onSpeechEnd: RecordingCallback
    ) {
    }

    public async append(chunk: Blob | ArrayBuffer) {
        const arrayBuf = chunk instanceof Blob ? await chunk.arrayBuffer() : chunk;
        const buffer = Buffer.from(arrayBuf);
        this.audioBuffer = Buffer.concat([this.audioBuffer, buffer]);

        if (isSilent(buffer)) {
            this.silentChunkCount++;
            const isSpeechEnded = this.silentChunkCount > this.maxSilentChunks && this.audioBuffer.length > 0;

            if (isSpeechEnded) {
                this.onSpeechEnd(this.audioBuffer);
                this.audioBuffer = Buffer.alloc(0);
                this.silentChunkCount = 0;
            }
        } else {
            this.silentChunkCount = 0; // 無音でない場合はカウンターをリセット
        }
    }
}