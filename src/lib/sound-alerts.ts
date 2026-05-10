type SoundType = "alert" | "action" | "success";

type ToneSpec = {
  frequencyHz: number;
  durationMs: number;
  volume: number;
};

const SOUND_TONE_MAP: Record<SoundType, ToneSpec> = {
  alert: { frequencyHz: 920, durationMs: 220, volume: 0.42 },
  action: { frequencyHz: 690, durationMs: 170, volume: 0.36 },
  success: { frequencyHz: 520, durationMs: 240, volume: 0.34 },
};

const sourceCache: Partial<Record<SoundType, string>> = {};

function encodeBase64FromBytes(bytes: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  if (typeof btoa === "function") {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return btoa(binary);
  }

  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0;
    const b = bytes[index + 1] ?? 0;
    const c = bytes[index + 2] ?? 0;
    const triple = (a << 16) | (b << 8) | c;

    output += alphabet[(triple >> 18) & 63];
    output += alphabet[(triple >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : "=";
    output += index + 2 < bytes.length ? alphabet[triple & 63] : "=";
  }

  return output;
}

function buildToneDataUri(spec: ToneSpec) {
  const sampleRate = 22_050;
  const channelCount = 1;
  const bitsPerSample = 16;
  const sampleCount = Math.floor((sampleRate * spec.durationMs) / 1000);
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channelCount * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = sampleCount * blockAlign;
  const totalSize = 44 + dataSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const maxAmplitude = 32767;
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const envelope = Math.exp((-4 * index) / sampleCount);
    const waveform = Math.sin(2 * Math.PI * spec.frequencyHz * time);
    const sample = waveform * envelope * spec.volume;
    view.setInt16(44 + index * 2, Math.floor(sample * maxAmplitude), true);
  }

  const bytes = new Uint8Array(buffer);
  return `data:audio/wav;base64,${encodeBase64FromBytes(bytes)}`;
}

function getSourceForSound(soundType: SoundType) {
  const cached = sourceCache[soundType];
  if (cached) {
    return cached;
  }

  const source = buildToneDataUri(SOUND_TONE_MAP[soundType]);
  sourceCache[soundType] = source;
  return source;
}

export async function playSound(soundType: SoundType, options?: { enabled?: boolean }) {
  if (options?.enabled === false || typeof Audio === "undefined") {
    return false;
  }

  try {
    const audio = new Audio(getSourceForSound(soundType));
    audio.preload = "auto";
    audio.loop = false;
    await audio.play();
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      console.info("Sound autoplay blocked. Use the Enable Sounds toggle to allow playback.");
      return false;
    }

    console.error("Failed to play sound alert:", error);
    return false;
  }
}

export const playAlertSound = (options?: { enabled?: boolean }) => playSound("alert", options);
export const playActionSound = (options?: { enabled?: boolean }) => playSound("action", options);
export const playSuccessSound = (options?: { enabled?: boolean }) => playSound("success", options);