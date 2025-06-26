import {WaveFile} from "wavefile";

export const convertAudioBufferToBase64 = (buf: Buffer): string => {
    const wav = new WaveFile();
    wav.fromBuffer(buf);
    wav.toSampleRate(16000);
    wav.toBitDepth("16");
    return wav.toBase64();
}