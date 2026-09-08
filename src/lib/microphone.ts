import { writable } from 'svelte/store';

let analyser: AnalyserNode | null = null;
let microphone: MediaStreamAudioSourceNode | null = null;
let stream: MediaStream | null = null;
let animationId: number | null = null;

export const isSpeaking = writable(false);

const SPEAKING_THRESHOLD = 30;
const SILENCE_FRAMES = 20;
let silenceCounter = 0;

export async function startMicrophoneAnalysis(): Promise<void> {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext();
    microphone = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    microphone.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkAudio = () => {
      if (!analyser) return;
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

      if (average > SPEAKING_THRESHOLD) {
        silenceCounter = 0;
        isSpeaking.set(true);
      } else {
        silenceCounter++;
        if (silenceCounter > SILENCE_FRAMES) {
          isSpeaking.set(false);
        }
      }
      animationId = requestAnimationFrame(checkAudio);
    };

    checkAudio();
  } catch (e) {
    console.error('Microphone access denied:', e);
  }
}

export function stopMicrophoneAnalysis(): void {
  if (animationId) cancelAnimationFrame(animationId);
  if (stream) stream.getTracks().forEach(t => t.stop());
  analyser = null;
  microphone = null;
  stream = null;
  isSpeaking.set(false);
}
