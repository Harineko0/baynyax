/** Environmental variables **/
const env = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: Number(process.env.PORT ?? "8081"),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
} as const;

const AudioConfig = {
  // Arduinoから送られてくる音声データのサンプルレート (例: 16kHz)
  SAMPLE_RATE: 16000,
  // ビット深度 (例: 16bit)
  BIT_DEPTH: 16,
  // 無音と判断する音量のしきい値 (0-1の範囲, 要調整)
  SILENCE_THRESHOLD: 0.01,
  // 発話終了とみなす無音の継続時間 (ミリ秒)
  SILENCE_DURATION_MS: 1500,
  // 1チャンクあたりの処理時間 (ミリ秒)
  CHUNK_DURATION_MS: 100,
} as const;

// 1チャンクのバイトサイズを計算
const CHUNK_SIZE =
    AudioConfig.SAMPLE_RATE * (AudioConfig.CHUNK_DURATION_MS / 1000) * (AudioConfig.BIT_DEPTH / 8);

export const AppConfig = {
  ...AudioConfig,
  CHUNK_SIZE,
} as const;

export default env;
