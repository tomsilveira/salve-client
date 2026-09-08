import { RnnoiseWorkletNode, loadRnnoise } from '@sapphi-red/web-noise-suppressor';
import rnnoiseWorkletPath from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';
import rnnoiseWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseWasmSimdPath from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';

export interface AudioProcessor {
  init(): Promise<void>;
  process(stream: MediaStream): Promise<MediaStream>;
  setEnabled(enabled: boolean): void;
  destroy(): void;
}

let rnnoiseWasmBinary: ArrayBuffer | null = null;

export class RNNoiseProcessor implements AudioProcessor {
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private workletNode: RnnoiseWorkletNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private inputStream: MediaStream | null = null;
  private outputStream: MediaStream | null = null;
  private bypassed = false;

  async init(): Promise<void> {
    if (!rnnoiseWasmBinary) {
      console.log('[NoiseSuppression] Loading RNNoise WASM binary...');
      rnnoiseWasmBinary = await loadRnnoise({
        url: rnnoiseWasmPath,
        simdUrl: rnnoiseWasmSimdPath,
      });
      console.log('[NoiseSuppression] WASM binary loaded, size:', rnnoiseWasmBinary.byteLength);
    }
  }

  async process(stream: MediaStream): Promise<MediaStream> {
    this.inputStream = stream;

    this.audioContext = new AudioContext({ sampleRate: 48000 });

    if (this.audioContext.state === 'suspended') {
      console.log('[NoiseSuppression] AudioContext suspended, resuming...');
      await this.audioContext.resume();
    }

    console.log('[NoiseSuppression] AudioContext state:', this.audioContext.state, 'sampleRate:', this.audioContext.sampleRate);

    await this.audioContext.audioWorklet.addModule(rnnoiseWorkletPath);
    console.log('[NoiseSuppression] Worklet module registered');

    this.source = this.audioContext.createMediaStreamSource(stream);

    this.workletNode = new RnnoiseWorkletNode(this.audioContext, {
      wasmBinary: rnnoiseWasmBinary!,
      maxChannels: 1,
    });

    this.destination = this.audioContext.createMediaStreamDestination();

    this.source.connect(this.workletNode);
    this.workletNode.connect(this.destination);

    this.outputStream = this.destination.stream;
    console.log('[NoiseSuppression] Processing chain connected: source -> worklet -> destination');
    return this.outputStream;
  }

  setEnabled(enabled: boolean): void {
    if (!this.source || !this.workletNode || !this.destination) return;

    if (!enabled && !this.bypassed) {
      this.source.disconnect();
      this.source.connect(this.destination);
      this.bypassed = true;
    } else if (enabled && this.bypassed) {
      this.source.disconnect();
      this.source.connect(this.workletNode);
      this.workletNode.connect(this.destination);
      this.bypassed = false;
    }
  }

  getProcessedTrack(): MediaStreamTrack | null {
    if (!this.outputStream) return null;
    const audioTracks = this.outputStream.getAudioTracks();
    return audioTracks.length > 0 ? audioTracks[0] : null;
  }

  destroy(): void {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.workletNode) {
      this.workletNode.destroy();
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.destination) {
      this.destination.disconnect();
      this.destination = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.outputStream = null;
    this.inputStream = null;
    this.bypassed = false;
  }
}
