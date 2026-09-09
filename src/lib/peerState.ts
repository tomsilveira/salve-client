let peerConnections: Map<string, RTCPeerConnection> = new Map();
let remoteStreams: Map<string, MediaStream> = new Map();
let screenStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let mixedAudioDestination: MediaStreamAudioDestinationNode | null = null;

export function getPeerConnections() { return peerConnections; }
export function getRemoteStreams() { return remoteStreams; }
export function getScreenStream() { return screenStream; }
export function setScreenStream(s: MediaStream | null) { screenStream = s; }
export function getAudioContext() { return audioContext; }
export function setAudioContext(ctx: AudioContext | null) { audioContext = ctx; }
export function getMixedAudioDestination() { return mixedAudioDestination; }
export function setMixedAudioDestination(dest: MediaStreamAudioDestinationNode | null) { mixedAudioDestination = dest; }

export function closeAllPeerConnections() {
  peerConnections.forEach(pc => pc.close());
  peerConnections.clear();
  remoteStreams.clear();
}
