import { AppConfig } from '../env';

/**
 * PCM 16bit Little Endian の音声データチャンクが
 * 無音かどうかを判定します。
 * @param chunk - 音声データ (Buffer)
 * @returns 無音であれば true
 */
export const isSilent = (chunk: Buffer): boolean => {
    const numSamples = chunk.length / (AppConfig.BIT_DEPTH / 8);

    // Bufferからサンプル値を読み込み、二乗和を計算
    const sumOfSquares = Array.from({ length: numSamples })
        .map((_, i) => chunk.readInt16LE(i * 2))
        .reduce((sum, sample) => sum + (sample / 32768) ** 2, 0);

    // RMS (Root Mean Square) を計算
    const rms = Math.sqrt(sumOfSquares / numSamples);

    return rms < AppConfig.SILENCE_THRESHOLD;
};