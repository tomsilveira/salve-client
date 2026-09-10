<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { get } from 'svelte/store';
  import type { Channel, VoicePeer } from './lib/types';
  import type { SignalClient } from './lib/signal';
import { liveStreams, connectedPeers, localVoiceStream, noiseSuppressionEnabled, inputDeviceId, outputDeviceId, remoteScreenStreams as remoteScreenStreamsStore, speakingUsers, screenShareStopFn } from './lib/stores';
import { playScreenStartSound, playScreenStopSound } from './lib/sounds';
import { micState } from './lib/micState';
import { getUploadUrl, getAvatarDisplayUrl } from './lib/api';
import { startMicrophoneAnalysis, stopMicrophoneAnalysis, isSpeaking } from './lib/microphone';
import { RNNoiseProcessor, type AudioProcessor } from './lib/noiseSuppression';
import { getPeerConnections, getRemoteStreams, setScreenStream as setSharedScreenStream, getScreenStream as getSharedScreenStream, getAudioContext, setAudioContext as setSharedAudioContext, getMixedAudioDestination, setMixedAudioDestination as setSharedMixedAudioDest } from './lib/peerState';

  const {
    channel,
    userId,
    username,
    signalClient = null,
    onLeave,
    onJoin = () => {},
    members = [],
    joined = false,
    currentUser: currentUserProp = null,
    voiceUsers = [],
  } = $props();

  let localVideo: HTMLVideoElement = $state() as any;
  let localScreen: HTMLVideoElement = $state() as any;
  let micEnabled = $state(false);
  let camEnabled = $state(false);
  let screenSharing = $state(false);
  let isLive = $state(false);
  let noiseProcessor: AudioProcessor | null = null;
  let noiseSuppressionReady = $state(false);
  let liveTitle = $state('');
  let liveGame = $state('');
  let liveCountry = $state('');
  let showLiveModal = $state(false);
  let hasAudioTrack = $state(false);
  let hasVideoTrack = $state(false);
  let callbacksSetup = false;
  const peerConnections = getPeerConnections();
  const remoteStreams = getRemoteStreams();

  // TURN server host: in dev uses backend host; in production, extract from VITE_API_URL.
  // NOTE: Render does not expose arbitrary ports (3478), so TURN won't work there.
  // A STUN-only fallback is used in production until a dedicated TURN service is configured.
  const turnHost = (() => {
    if (typeof window === 'undefined') return 'localhost';
    const apiEnv = import.meta.env.VITE_API_URL;
    if (apiEnv) {
      try { return new URL(apiEnv).hostname; } catch { /* ignore */ }
    }
    return window.location.hostname;
  })();
  const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // TODO: Production TURN requires a dedicated service (e.g., Twilio, metered.ca).
      // Render does not expose port 3478. Uncomment below when TURN is available.
      // {
      //   urls: `turn:${turnHost}:3478?transport=udp`,
      //   username: 'salve',
      //   credential: 'salve-turn-2024'
      // },
      // {
      //   urls: `turn:${turnHost}:3478?transport=tcp`,
      //   username: 'salve',
      //   credential: 'salve-turn-2024'
      // }
    ],
    iceCandidatePoolSize: 10
  };

  async function createPeerConnection(peerId: string, channelId: string, isInitiator: boolean): Promise<RTCPeerConnection> {
    const existingPc = peerConnections.get(peerId);
    if (existingPc) {
      existingPc.close();
      peerConnections.delete(peerId);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.set(peerId, pc);

    if ($localVoiceStream) {
      $localVoiceStream.getTracks().forEach(track => {
        pc.addTrack(track, $localVoiceStream!);
      });
    }

     if (screenStream) {
      screenStream.getTracks().forEach(track => {
        track.enabled = true;
        pc.addTrack(track, screenStream!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate && signalClient) {
        signalClient.sendSignal(peerId, channelId, {
          type: 'rtp-ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state for', peerId, ':', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state for', peerId, ':', pc.connectionState);
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const track = event.track;
      console.log('Remote track received:', track.kind, 'from:', peerId);
      console.log('[VoicePanel] Remote track details:', {
        kind: track.kind,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        id: track.id,
        streamId: remoteStream?.id,
        streamTrackCount: remoteStream?.getTracks().length,
        streamAudioTracks: remoteStream?.getAudioTracks().length,
        streamVideoTracks: remoteStream?.getVideoTracks().length,
      });

      if (track.kind === 'audio') {
        remoteStreams.set(peerId, remoteStream);
        let audio = document.getElementById(`audio-${peerId}`) as HTMLAudioElement;
        const existed = !!audio;
        if (!audio) {
          audio = document.createElement('audio');
          audio.id = `audio-${peerId}`;
          audio.autoplay = true;
          (audio as any).playsInline = true;
          document.body.appendChild(audio);
        }
        audio.srcObject = remoteStream;
        if ($outputDeviceId !== 'default' && typeof (audio as any).setSinkId === 'function') {
          (audio as any).setSinkId($outputDeviceId).catch(() => {});
        }

        console.log('[VoicePanel] Remote audio element:', {
          id: audio.id,
          existed,
          paused: audio.paused,
          muted: audio.muted,
          volume: audio.volume,
          readyState: audio.readyState,
          autoplay: audio.autoplay,
          playsInline: audio.playsInline,
          srcObjectSet: !!audio.srcObject,
          audioTracks: remoteStream.getAudioTracks().map(t => ({
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState,
            kind: t.kind,
          })),
        });

        audio.play().then(() => {
          console.log('[VoicePanel] Remote audio playback started for', peerId);
        }).catch((e) => {
          console.warn('[VoicePanel] Remote audio autoplay blocked:', e?.message || e);
        });
      } else if (track.kind === 'video') {
        playScreenStartSound();
        remoteScreenStreams.set(peerId, remoteStream);
        syncScreenStreamsToStore();
        screenUpdateCounter++;
        track.onended = () => {
          console.log('[ScreenShare] Remote video track ended for', peerId);
          if (remoteScreenStreams.has(peerId)) {
            const el = videoEls[peerId];
            if (el) el.srcObject = null;
            remoteScreenStreams.delete(peerId);
            syncScreenStreamsToStore();
            screenUpdateCounter++;
            featuredScreen = featuredScreen === peerId ? null : featuredScreen;
            cleanupRemoteAudio(peerId);
          }
        };
      }
    };

    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('createPeerConnection senders:', pc.getSenders().length, pc.getSenders().map(s => s.track?.kind));
        console.log('Offer SDP has video:', offer.sdp?.includes('m=video'));
        signalClient?.sendSignal(peerId, channelId, { type: 'offer', offer });
      } catch (e) {
        console.error('Failed to create/send offer for', peerId, e);
        pc.close();
        peerConnections.delete(peerId);
        throw e;
      }
    }

    return pc;
  }

  async function handleSignal(signal: any) {
    const from = signal.from;
    if (!from) return;

    const channelId = channel.id;

    if (signal.type === 'offer') {
      let pc = peerConnections.get(from);
      if (pc && pc.signalingState !== 'closed') {
        console.log('[Signal] Renegotiation offer from', from, 'current state:', pc.signalingState);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
          console.log('[Signal] Renegotiation SDP has video:', signal.data?.sdp?.includes('m=video'));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log('[Signal] Renegotiation answer has video:', answer.sdp?.includes('m=video'));
          signalClient?.sendSignal(from, channelId, { type: 'answer', answer });
        } catch (e) {
          console.error('[Signal] Failed to handle renegotiation offer from', from, e);
        }
      } else {
        if (pc) {
          pc.close();
          peerConnections.delete(from);
        }
        await ensureLocalStream();
        try {
          pc = await createPeerConnection(from, channelId, false);
          await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
          console.log('Received offer SDP has video:', signal.data?.sdp?.includes('m=video'));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log('Answer SDP has video:', answer.sdp?.includes('m=video'));
          signalClient?.sendSignal(from, channelId, { type: 'answer', answer });
        } catch (e) {
          console.error('Failed to handle offer from', from, e);
          if (pc) {
            pc.close();
            peerConnections.delete(from);
          }
        }
      }
    } else if (signal.type === 'answer') {
      const pc = peerConnections.get(from);
      if (pc && pc.signalingState === 'have-local-offer') {
        try {
          console.log('Received answer SDP has video:', signal.data?.sdp?.includes('m=video'));
          await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
        } catch (e: any) {
          console.warn('[Signal] Failed to set remote answer, retrying with ICE restart:', e.message);
          try {
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            signalClient?.sendSignal(from, channelId, { type: 'offer', offer });
          } catch (e2) {
            console.error('[Signal] ICE restart renegotiation failed, closing PC:', e2);
            pc.close();
            peerConnections.delete(from);
          }
        }
      } else if (pc) {
        console.warn('Ignoring answer from', from, '- PC state:', pc.signalingState);
      }
    } else if (signal.type === 'screen-share-stopped') {
      console.log('[ScreenShare] Received screen-share-stopped from:', from, 'remoteScreenStreams.has(from):', remoteScreenStreams.has(from), 'remoteScreenStreams keys:', [...remoteScreenStreams.keys()]);
      playScreenStopSound();
      if (remoteScreenStreams.has(from)) {
        const el = videoEls[from];
        if (el) el.srcObject = null;
        remoteScreenStreams.delete(from);
        syncScreenStreamsToStore();
        screenUpdateCounter++;
        featuredScreen = featuredScreen === from ? null : featuredScreen;
        cleanupRemoteAudio(from);
        console.log('[ScreenShare] Cleaned up remote screen for:', from);
      }
    } else if (signal.type === 'ice-candidate') {
      const pc = peerConnections.get(from);
      if (pc && signal.data && pc.signalingState !== 'closed') {
        const sdpMid = signal.sdpMid != null ? signal.sdpMid : undefined;
        const sdpMLineIndex = signal.sdpMLineIndex != null ? signal.sdpMLineIndex : undefined;
        if (sdpMid !== undefined || sdpMLineIndex !== undefined) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate({
              candidate: signal.data,
              sdpMid: sdpMid,
              sdpMLineIndex: sdpMLineIndex,
            }));
          } catch (e) {
            console.error('Failed to add ICE candidate:', e);
          }
        }
      }
    }
  }

  function cleanupPeerConnections() {
    stopMixedAudio();
    callbacksSetup = false;
    if (noiseProcessor) {
      noiseProcessor.destroy();
      noiseProcessor = null;
      noiseSuppressionReady = false;
    }
    peerConnections.forEach(pc => pc.close());
    peerConnections.clear();
    remoteStreams.forEach((_, peerId) => {
      const audio = document.getElementById(`audio-${peerId}`);
      if (audio) audio.remove();
    });
    remoteStreams.clear();
    remoteScreenStreams.forEach((_, peerId) => {
      const el = videoEls[peerId];
      if (el) el.srcObject = null;
    });
    remoteScreenStreams.clear();
    syncScreenStreamsToStore();
    screenAttachedEls.clear();
    screenPlayState.clear();
  }

  const memberMap = $derived(new Map(members.map((m) => [m.userId, m.user])));
  const currentUser = $derived(currentUserProp || memberMap.get(userId));
  const peers = $derived($connectedPeers);
  const statusMap = $derived(new Map(members.map((m) => [m.userId, m.status || 'offline'])));
  const localUserStatus = $derived(currentUser?.status || 'online');
  const remoteScreenEntries = $derived.by(() => {
    screenUpdateCounter;
    return Array.from(remoteScreenStreams.entries());
  });

  $effect(() => {
    console.log(`VoicePanel: ${channel.name}, joined: ${joined}, voiceUsers: ${voiceUsers.length}, peers: ${peers.size}`);
  });

  const screenPlayState: Map<string, boolean> = new Map();
  const screenAttachedEls: Set<string> = new Set();
  let expandedScreens: Set<string> = $state(new Set());
  const hasExpandedScreen = $derived(expandedScreens.size > 0 || featuredScreen !== null);

  function attachScreenVideo(peerId: string, el: HTMLVideoElement, stream: MediaStream) {
    const prevStream = el.srcObject as MediaStream | null;
    if (prevStream === stream && screenAttachedEls.has(peerId)) return;
    screenAttachedEls.add(peerId);
    screenPlayState.delete(peerId);

    console.log('[ScreenVideo] Attaching stream for', peerId);
    el.srcObject = stream;
    el.muted = true;

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const tryPlay = () => {
        if (screenPlayState.get(peerId)) return;
        el.play().then(() => {
          screenPlayState.set(peerId, true);
          console.log('[ScreenVideo] play() resolved for', peerId, 'readyState:', el.readyState, el.videoWidth, 'x', el.videoHeight);
        }).catch((e) => {
          console.log('[ScreenVideo] play() failed for', peerId, e);
        });
      };

      tryPlay();

      if (videoTrack.muted) {
        console.log('[ScreenVideo] Track muted, polling for unmute for', peerId);
        videoTrack.addEventListener('unmute', () => {
          console.log('[ScreenVideo] Track unmuted for', peerId);
          tryPlay();
        }, { once: true });
        const pollInterval = setInterval(() => {
          if (!videoTrack.muted || screenPlayState.get(peerId)) {
            clearInterval(pollInterval);
            tryPlay();
          }
        }, 500);
        videoTrack.addEventListener('ended', () => clearInterval(pollInterval));
      }

      videoTrack.addEventListener('ended', () => {
        console.log('[ScreenVideo] Track ended for', peerId);
        screenPlayState.delete(peerId);
      });
    }

    el.addEventListener('error', (e) => {
      console.log('[ScreenVideo] Error for', peerId, e);
    });
  }

  $effect(() => {
    const _ = screenUpdateCounter;
    const entries = Array.from(remoteScreenStreams.entries());
    console.log('[ScreenVideo] effect: entries=', entries.length, 'videoEls=', Object.keys(videoEls));
    for (const [peerId, stream] of entries) {
      const el = videoEls[peerId];
      const videoTracks = stream.getVideoTracks();
      console.log('[ScreenVideo] element for', peerId, ':', el ? 'found' : 'NOT FOUND', 'tracks:', videoTracks.length, 'muted:', videoTracks[0]?.muted, 'expanded:', expandedScreens.has(peerId));
      if (el && expandedScreens.has(peerId)) {
        attachScreenVideo(peerId, el, stream);
      } else if (el && !expandedScreens.has(peerId)) {
        el.srcObject = null;
        screenAttachedEls.delete(peerId);
        screenPlayState.delete(peerId);
      }
    }
  });

  let micInitPromise: Promise<void> | null = null;

  async function initMic() {
    if ($localVoiceStream) return;
    if (micInitPromise) { await micInitPromise; return; }
    micInitPromise = (async () => {
      try {
        const rawStream = await navigator.mediaDevices.getUserMedia({ audio: $inputDeviceId === 'default' ? true : { deviceId: { exact: $inputDeviceId } } });
        hasAudioTrack = true;
        hasVideoTrack = false;
        micEnabled = true;
        camEnabled = false;

        if ($noiseSuppressionEnabled) {
          await setupNoiseSuppression(rawStream);
        } else {
          localVoiceStream.set(rawStream);
        }

        console.log('Audio only mode', $noiseSuppressionEnabled ? '(noise suppression ON)' : '(noise suppression OFF)');
      } catch (e) {
        console.error('No audio input available', e);
      } finally {
        micInitPromise = null;
      }
    })();
    await micInitPromise;
  }

  async function setupNoiseSuppression(rawStream: MediaStream) {
    try {
      if (!noiseProcessor) {
        noiseProcessor = new RNNoiseProcessor();
        await noiseProcessor.init();
      }
      const processedStream = await noiseProcessor.process(rawStream);
      noiseSuppressionReady = true;
      localVoiceStream.set(processedStream);
      console.log('[NoiseSuppression] Active - audio routed through RNNoise');
    } catch (e) {
      console.warn('[NoiseSuppression] Failed to initialize, using raw audio:', e);
      noiseProcessor = null;
      noiseSuppressionReady = false;
      localVoiceStream.set(rawStream);
    }
  }

  async function ensureLocalStream(): Promise<MediaStream | null> {
    if (!$localVoiceStream) {
      await initMic();
    }
    return $localVoiceStream;
  }

  function preferVideoCodec(sdp: string, codec: string): string {
    const lines = sdp.split(/\r?\n/);
    let mVideoIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('m=video')) {
        mVideoIndex = i;
        break;
      }
    }
    if (mVideoIndex === -1) return sdp;

    // Find all rtpmap lines for video
    const codecPayloads: { [key: string]: string } = {};
    for (let i = mVideoIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith('m=')) break;
      const rtpmap = lines[i].match(/^a=rtpmap:(\d+)\s+([^\/]+)\//);
      if (rtpmap) {
        codecPayloads[rtpmap[1]] = rtpmap[2];
      }
    }

    // Find the payload type for the desired codec
    let targetPayload: string | null = null;
    for (const [pt, name] of Object.entries(codecPayloads)) {
      if (name.toUpperCase() === codec.toUpperCase()) {
        targetPayload = pt;
        break;
      }
    }

    if (!targetPayload) return sdp;

    // Reorder payload types in m=video line
    const mLine = lines[mVideoIndex];
    const parts = mLine.split(' ');
    const header = parts.slice(0, 3); // m=video <port> <proto>
    const payloads = parts.slice(3);
    const targetIdx = payloads.indexOf(targetPayload);
    if (targetIdx > 0) {
      payloads.splice(targetIdx, 1);
      payloads.unshift(targetPayload);
    }
    lines[mVideoIndex] = [...header, ...payloads].join(' ');

    return lines.join('\r\n');
  }

  function setVideoEl(node: HTMLVideoElement, peerId: string) {
    videoEls[peerId] = node;
    videoEls = videoEls;
    return {
      destroy() {
        delete videoEls[peerId];
        videoEls = videoEls;
      }
    };
  }

  function handleSignalOffer(offer: any) {
    console.log('Received signal', offer);
  }

  let screenStream = $state(getSharedScreenStream());
  const remoteScreenStreams: Map<string, MediaStream> = $state(new Map());
  let screenUpdateCounter = $state(0);
  let videoEls: Record<string, HTMLVideoElement> = $state({});
  let featuredScreen: string | null = $state(null);
  let screenAudioActive = $state(false);
  let audioContext: AudioContext | null = $state(getAudioContext());
  let mixedAudioDestination: MediaStreamAudioDestinationNode | null = $state(getMixedAudioDestination());

  function syncScreenStreamsToStore() {
    remoteScreenStreamsStore.set(new Map(remoteScreenStreams));
  }

  function cleanupRemoteAudio(peerId: string) {
    const audio = document.getElementById(`audio-${peerId}`);
    if (audio) {
      (audio as HTMLAudioElement).srcObject = null;
      audio.remove();
    }
  }

  function getMixedAudioStream(): MediaStream | null {
    if (!$localVoiceStream || !screenStream) return null;
    const screenAudioTracks = screenStream.getAudioTracks();
    if (screenAudioTracks.length === 0) return $localVoiceStream;

    if (!audioContext) {
      audioContext = new AudioContext();
      setSharedAudioContext(audioContext);
    }
    if (mixedAudioDestination) {
      mixedAudioDestination.disconnect();
      mixedAudioDestination = null;
      setSharedMixedAudioDest(null);
    }
    mixedAudioDestination = audioContext.createMediaStreamDestination();
    setSharedMixedAudioDest(mixedAudioDestination);

    const micSource = audioContext.createMediaStreamSource($localVoiceStream);
    micSource.connect(mixedAudioDestination);

    const screenAudioSource = audioContext.createMediaStreamSource(new MediaStream(screenAudioTracks));
    screenAudioSource.connect(mixedAudioDestination);

    console.log('[Audio] Mixed mic + screen audio into single track');
    return mixedAudioDestination.stream;
  }

  function stopMixedAudio() {
    if (mixedAudioDestination) {
      mixedAudioDestination.disconnect();
      mixedAudioDestination = null;
      setSharedMixedAudioDest(null);
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
      audioContext = null;
      setSharedAudioContext(null);
    }
  }

  async function startScreenShare() {
    if (screenSharing) {
      console.log('Screen share already in progress');
      return;
    }
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setSharedScreenStream(screenStream);
      screenAudioActive = screenStream.getAudioTracks().length > 0;
      console.log('[ScreenShare] Audio tracks:', screenStream.getAudioTracks().length, 'audio active:', screenAudioActive);
      screenSharing = true;
      screenShareStopFn.set(stopScreenShare);
      await tick();
      if (localScreen) {
        localScreen.srcObject = screenStream;
        localScreen.muted = true;
      }

      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrack.onended = () => {
        stopScreenShare();
      };

      console.log('Starting screen share, peer connections:', peerConnections.size, 'signalClient:', !!signalClient);

      if (!signalClient) {
        console.error('signalClient is null, cannot send offer');
        return;
      }

      for (const [peerId, pc] of peerConnections) {
        if (pc.signalingState === 'closed') continue;
        screenStream.getTracks().forEach(track => {
          pc.addTrack(track, screenStream!);
        });
        console.log('Screen track added to existing PC for', peerId, 'state:', pc.signalingState);
        if (pc.signalingState === 'stable') {
          renegotiate(peerId, pc);
        } else {
          console.log('[ScreenShare] PC not stable for', peerId, 'state:', pc.signalingState, 'waiting for stable to renegotiate');
          const onStateChange = () => {
            if (pc.signalingState === 'stable') {
              pc.removeEventListener('signalingstatechange', onStateChange);
              renegotiate(peerId, pc);
            }
          };
          pc.addEventListener('signalingstatechange', onStateChange);
        }
      }
    } catch (e) {
      console.error('Screen share failed', e);
    screenSharing = false;
    screenShareStopFn.set(null);
    }
  }

  async function renegotiate(peerId: string, pc: RTCPeerConnection) {
    try {
      const offer = await pc.createOffer({ iceRestart: false });
      await pc.setLocalDescription(offer);
      signalClient?.sendSignal(peerId, channel.id, { type: 'offer', offer });
    } catch (e: any) {
      console.warn('[Renegotiate] Offer failed, retrying with ICE restart:', e.message);
      try {
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        signalClient?.sendSignal(peerId, channel.id, { type: 'offer', offer });
      } catch (e2) {
        console.error('Renegotiation failed even with ICE restart', e2);
      }
    }
  }

  function stopScreenShare() {
    const oldScreenTracks = screenStream ? screenStream.getTracks() : [];
    stopMixedAudio();
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
      screenStream = null;
      setSharedScreenStream(null);
    }
    screenSharing = false;
    screenAudioActive = false;
    if (localScreen) {
      localScreen.srcObject = null;
    }

    console.log('[ScreenShare] stopScreenShare: peers to notify:', peerConnections.size, 'ids:', [...peerConnections.keys()]);
    peerConnections.forEach(async (pc, peerId) => {
      for (const sender of pc.getSenders()) {
        if (sender.track && oldScreenTracks.some(t => t.id === sender.track!.id)) {
          try { await sender.replaceTrack(null); } catch {}
        }
      }
      console.log('[ScreenShare] Sending screen-share-stopped to', peerId, 'signalClient:', !!signalClient, 'channelId:', channel.id);
      signalClient?.sendSignal(peerId, channel.id, { type: 'screen-share-stopped' });
    });

    remoteScreenStreams.forEach((_, peerId) => {
      const el = videoEls[peerId];
      if (el) el.srcObject = null;
    });
    remoteScreenStreams.clear();
    syncScreenStreamsToStore();
    screenUpdateCounter++;
  }

  function toggleCam() {
    if ($localVoiceStream) {
      $localVoiceStream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
      camEnabled = $localVoiceStream.getVideoTracks().every((t) => t.enabled);
    } else {
      initMic();
    }
  }

  function toggleMic() {
    if ($localVoiceStream) {
      $localVoiceStream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      micEnabled = $localVoiceStream.getAudioTracks().every((t) => t.enabled);
    }
  }

  async function toggleNoiseSuppression() {
    const newState = !$noiseSuppressionEnabled;
    noiseSuppressionEnabled.set(newState);

    if (!joined || !$localVoiceStream) return;

    if (newState) {
      const rawStream = await navigator.mediaDevices.getUserMedia({ audio: $inputDeviceId === 'default' ? true : { deviceId: { exact: $inputDeviceId } } });
      await setupNoiseSuppression(rawStream);
    } else {
      if (noiseProcessor) {
        noiseProcessor.destroy();
        noiseProcessor = null;
        noiseSuppressionReady = false;
      }
      const rawStream = await navigator.mediaDevices.getUserMedia({ audio: $inputDeviceId === 'default' ? true : { deviceId: { exact: $inputDeviceId } } });
      localVoiceStream.set(rawStream);
    }

    const newAudioTrack = $localVoiceStream?.getAudioTracks()[0];
    if (newAudioTrack) {
      for (const [, pc] of peerConnections) {
        const audioSender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (audioSender) {
          try { await audioSender.replaceTrack(newAudioTrack); } catch (e) {
            console.warn('[NoiseSuppression] Failed to replace track:', e);
          }
        }
      }
    }
  }

  function toggleLive() {
    if (isLive) {
      stopLive();
    } else {
      showLiveModal = true;
    }
  }

  function startLive() {
    if (!liveTitle.trim()) return;
    isLive = true;
    showLiveModal = false;
    const liveId = `${userId}-${Date.now()}`;
    liveStreams.update((streams) => [...streams, {
      id: liveId,
      title: liveTitle,
      streamer: {
        id: userId,
        username,
        avatarUrl: '',
        status: 'online' as const,
        activity: `Transmitindo ${liveGame || liveTitle}`,
      },
      gameName: liveGame || 'Geral',
      viewerCount: 0,
      durationMinutes: 0,
      thumbnailUrl: `https://picsum.photos/seed/${Date.now()}/400x225`,
      isLive: true,
      channelId: channel?.id,
    }]);
    signalClient?.startLive(liveId, liveTitle, liveGame || 'Geral', channel?.id || '');
  }

  function stopLive() {
    const myLive = $liveStreams.find(s => s.streamer.id === userId);
    if (myLive) {
      signalClient?.stopLive(myLive.id);
    }
    isLive = false;
    liveStreams.update((streams) => streams.filter((s) => s.streamer.id !== userId));
    liveTitle = '';
    liveGame = '';
    liveCountry = '';
  }

  function leaveVoice() {
    if (screenSharing) {
      stopScreenShare();
    }
    if (noiseProcessor) {
      noiseProcessor.destroy();
      noiseProcessor = null;
      noiseSuppressionReady = false;
    }
    if ($localVoiceStream) {
      $localVoiceStream.getTracks().forEach((t) => t.stop());
      localVoiceStream.set(null);
    }
    onLeave();
  }

  onMount(() => {
    console.log('VoicePanel onMount: joined:', joined, 'signalClient:', !!signalClient);
    if (joined) {
      initMic();
      startMicrophoneAnalysis();
    }
    setupCallbacks();
  });

  function setupCallbacks() {
    if (!signalClient || callbacksSetup) return;
    callbacksSetup = true;
    console.log('[VoicePanel] setupCallbacks called, joined:', joined, 'channel:', channel.id);
    signalClient.onPeerJoined = async (peer: VoicePeer) => {
      if (peer.userId === userId) {
        console.log('[VoicePanel] Ignoring self voice-joined');
        return;
      }
      const currentJoined = joined;
      console.log('[VoicePanel] onPeerJoined:', peer.username, 'userId:', peer.userId, 'localUserId:', userId, 'isInitiator:', userId < peer.userId, 'joined:', currentJoined);
      connectedPeers.update((m) => {
        const newMap = new Map(m);
        newMap.set(peer.userId, peer);
        return newMap;
      });
      if (currentJoined && userId < peer.userId) {
        if (!peerConnections.has(peer.userId)) {
          console.log('[VoicePanel] Creating peer connection as initiator for', peer.username);
          await ensureLocalStream();
          await createPeerConnection(peer.userId, channel.id, true);
        } else {
          console.log('[VoicePanel] Peer already has PC, skipping create for', peer.username);
        }
      } else if (currentJoined) {
        console.log('[VoicePanel] Waiting for offer from', peer.username, '(they are initiator)');
      } else {
        console.warn('[VoicePanel] NOT creating PC - joined is false');
      }
    };

    // Create peer connections for peers that joined BEFORE setupCallbacks ran
    const currentPeers = get(connectedPeers);
    for (const [peerId, peer] of currentPeers) {
      if (peerId === userId) continue;
      if (!peerConnections.has(peerId) && joined) {
        console.log('[VoicePanel] Late peer detected, creating PC for', peer.username, 'isInitiator:', userId < peerId);
        (async () => {
          await ensureLocalStream();
          if (userId < peerId) {
            await createPeerConnection(peerId, channel.id, true);
          }
        })();
      }
    }
    signalClient.onPeerLeft = (uid: string) => {
      console.log('[VoicePanel] onPeerLeft:', uid);
      connectedPeers.update((m) => {
        const newMap = new Map(m);
        newMap.delete(uid);
        return newMap;
      });
      const pc = peerConnections.get(uid);
      if (pc) {
        pc.close();
        peerConnections.delete(uid);
      }
      remoteStreams.delete(uid);
      const audio = document.getElementById(`audio-${uid}`);
      if (audio) audio.remove();
      if (remoteScreenStreams.has(uid)) {
        const screenEl = videoEls[uid];
        if (screenEl) {
          screenEl.srcObject = null;
        }
        remoteScreenStreams.delete(uid);
        syncScreenStreamsToStore();
        screenUpdateCounter++;
      }
    };
    signalClient.onSignal = handleSignal;
    signalClient.onLiveStart = (data) => {
      console.log('[VoicePanel] onLiveStart:', data.username, data.title);
      liveStreams.update((streams) => {
        if (streams.some(s => s.id === data.liveId)) return streams;
        return [...streams, {
          id: data.liveId,
          title: data.title,
          streamer: {
            id: data.userId,
            username: data.username,
            avatarUrl: data.avatarUrl,
            status: 'online' as const,
            activity: `Transmitindo ${data.gameName}`,
          },
          gameName: data.gameName,
          viewerCount: 0,
          durationMinutes: 0,
          thumbnailUrl: `https://picsum.photos/seed/${data.liveId}/400x225`,
          isLive: true,
          channelId: data.channelId,
        }];
      });
    };
    signalClient.onLiveStop = (liveId) => {
      console.log('[VoicePanel] onLiveStop:', liveId);
      liveStreams.update((streams) => streams.filter(s => s.id !== liveId));
    };
    signalClient.onSpeaking = (channelId: string, userId: string, speaking: boolean) => {
      speakingUsers.update((set) => {
        const newSet = new Set(set);
        if (speaking) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    };
  }

   $effect(() => {
    const isJoined = joined;
    const sc = signalClient;
    console.log('[VoicePanel] $effect: joined:', isJoined, 'signalClient:', !!sc);
    if (isJoined && sc) {
      ensureLocalStream();
      startMicrophoneAnalysis();
      setupCallbacks();
    } else if (!isJoined) {
      stopMicrophoneAnalysis();
      cleanupPeerConnections();
    }
  });

  $effect(() => {
    const speaking = $isSpeaking;
    const sc = signalClient;
    const ch = channel;
    if (sc && ch) {
      sc.sendSpeaking(ch.id, speaking);
    }
  });

  onDestroy(() => {
    stopMicrophoneAnalysis();
    cleanupPeerConnections();
  });
</script>

<div class="voice-container">
  <div class="voice-header">
    <div class="voice-header-info">
      <span class="voice-icon">🔊</span>
      <span class="channel-name">{channel.name}</span>
      <span class="channel-type-badge">Canal de Voz</span>
    </div>
    {#if joined}
      <button class="leave-btn" onclick={leaveVoice} title="Desconectar da chamada">Desconectar 📞</button>
    {:else}
      <button class="join-header-btn" onclick={() => onJoin(channel)}>Entrar na Voz ⎆</button>
    {/if}
  </div>

  <div class="voice-grid">
    {#if camEnabled || screenSharing}
      <div class="video-slot local-video-container">
        {#if screenSharing}
          <video bind:this={localScreen} class="video-screen" autoplay muted playsinline></video>
        {:else}
          <video bind:this={localVideo} class="video-local" autoplay muted playsinline></video>
        {/if}
        {#if !camEnabled && !screenSharing}
          <div class="cam-off-overlay">Câmera desligada</div>
        {/if}
      </div>
    {:else if joined}
      <div class="voice-users-grid" class:hidden={hasExpandedScreen}>
        <div class="voice-user-card local">
          <div class="voice-user-avatar local" class:speaking={$isSpeaking} title={username}>
            {#if currentUser?.avatarUrl}
              <img src="{getAvatarDisplayUrl(currentUser.avatarUrl)}" alt={username} />
            {:else}
              <span>{username?.[0]?.toUpperCase() || '?'}</span>
            {/if}
            <div
              class="voice-user-status"
              class:online={localUserStatus === 'online'}
              class:away={localUserStatus === 'away'}
              class:dnd={localUserStatus === 'do-not-disturb'}
              class:offline={localUserStatus === 'invisible' || localUserStatus === 'offline'}
            ></div>
          </div>
          <span class="voice-user-name">{username}</span>
          <span class="voice-user-role">Você</span>
        </div>
        {#each voiceUsers.filter((u: any) => u.id !== userId) as user (user.id)}
          {@const userStatus = user.status || statusMap.get(user.id) || 'online'}
          {@const isUserSpeaking = $speakingUsers.has(user.id)}
          <div class="voice-user-card">
            <div class="voice-user-avatar" class:speaking={isUserSpeaking} title={user.username}>
              {#if user.avatarUrl}
                <img src="{getAvatarDisplayUrl(user.avatarUrl)}" alt={user.username} />
              {:else}
                <span>{user.username?.[0]?.toUpperCase() || '?'}</span>
              {/if}
              <div
                class="voice-user-status"
                class:online={userStatus === 'online'}
                class:away={userStatus === 'away'}
                class:dnd={userStatus === 'do-not-disturb'}
                class:offline={userStatus === 'invisible' || userStatus === 'offline'}
              ></div>
            </div>
            <span class="voice-user-name">{user.username}</span>
          </div>
        {/each}
      </div>
    {:else}
      <!-- PREVIEW OF PARTICIPANTS WHEN NOT YET CONNECTED -->
      <div class="voice-preview-container">
        <div class="preview-header-box">
          <div class="preview-channel-icon">🔊</div>
          <h3>{channel.name}</h3>
          <p class="preview-channel-desc">
            {#if voiceUsers.length > 0}
              <strong>{voiceUsers.length}</strong> usuário(s) conectado(s) nesta sala de voz:
            {:else}
              Ninguém está conectado nesta sala de voz no momento.
            {/if}
          </p>
        </div>

        {#if voiceUsers.length > 0}
          <div class="preview-participants-grid">
            {#each voiceUsers as user (user.id)}
              {@const userStatus = user.status || statusMap.get(user.id) || 'online'}
              <div class="preview-participant-card">
                <div class="preview-card-avatar">
                  {#if user.avatarUrl}
                    <img src={getUploadUrl(user.avatarUrl)} alt={user.username} />
                  {:else}
                    <span>{user.username?.[0]?.toUpperCase() || '?'}</span>
                  {/if}
                  <div
                    class="preview-card-status"
                    class:online={userStatus === 'online'}
                    class:away={userStatus === 'away'}
                    class:dnd={userStatus === 'do-not-disturb'}
                    class:offline={userStatus === 'invisible' || userStatus === 'offline'}
                  ></div>
                </div>
                <div class="preview-card-details">
                  <span class="preview-card-username">{user.username}</span>
                  <span class="preview-card-status-text">
                    {userStatus === 'away' ? 'Ausente' : userStatus === 'do-not-disturb' ? 'Ocupado' : userStatus === 'invisible' ? 'Invisível' : 'Online'}
                  </span>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <div class="preview-action-box">
          <button class="btn-connect-voice" onclick={() => onJoin(channel)}>
            <span>⎆</span> {voiceUsers.length > 0 ? 'Conectar à Sala de Voz' : 'Entrar e Iniciar Conversa'}
          </button>
        </div>
      </div>
    {/if}

    {#if joined && remoteScreenEntries.length > 0}
      <div class="remote-screens">
        {#each remoteScreenEntries as [peerId, stream] (peerId)}
          {@const peer = peers.get(peerId)}
          {@const isExpanded = expandedScreens.has(peerId)}
          <button
            class="remote-screen-container"
            class:featured={featuredScreen === peerId}
            class:expanded={isExpanded}
            onclick={() => {
              if (!isExpanded) {
                expandedScreens = new Set([...expandedScreens, peerId]);
                screenUpdateCounter++;
              } else {
                featuredScreen = featuredScreen === peerId ? null : peerId;
              }
            }}
            type="button"
          >
            {#if isExpanded}
              <video class="remote-screen-video" autoplay playsinline use:setVideoEl={peerId}></video>
              <button
                class="screen-close-btn"
                onclick={(e) => {
                  e.stopPropagation();
                  expandedScreens = new Set([...expandedScreens].filter(id => id !== peerId));
                  featuredScreen = featuredScreen === peerId ? null : featuredScreen;
                  screenUpdateCounter++;
                  cleanupRemoteAudio(peerId);
                }}
                type="button"
                title="Fechar"
              >✕</button>
            {:else}
              <div class="screen-placeholder">
                <div class="screen-placeholder-avatar">
                  {#if peer?.avatarUrl}
                    <img src={getUploadUrl(peer.avatarUrl)} alt={peer.username} />
                  {:else}
                    <div class="avatar-letter">{peer?.username?.[0]?.toUpperCase() || '?'}</div>
                  {/if}
                </div>
                <div class="screen-placeholder-info">
                  <span class="screen-placeholder-name">{peer?.displayName || peer?.username || 'Unknown'}</span>
                  <span class="screen-placeholder-status">🖥 Compartilhando Tela</span>
                </div>
              </div>
            {/if}
            <div class="remote-screen-label">{peer?.displayName || peer?.username || 'Unknown'}</div>
          </button>
        {/each}
      </div>
    {/if}


  </div>

  {#if joined}
    <div class="voice-controls">
      <button class="control-btn" class:enabled={micEnabled} onclick={toggleMic} title="Microfone">
        {#if micEnabled}🎤{:else}🔇{/if}
      </button>
      <button class="control-btn" class:enabled={camEnabled} onclick={toggleCam} title="Câmera">
        {#if camEnabled}📹{:else}📷{/if}
      </button>
      <button
        class="control-btn noise-suppression-btn"
        class:enabled={$noiseSuppressionEnabled}
        onclick={toggleNoiseSuppression}
        title={$noiseSuppressionEnabled ? 'Desligar supressão de ruído' : 'Ligar supressão de ruído'}
      >
        {#if $noiseSuppressionEnabled}🔊{:else}🔉{/if}
      </button>
      <button class="control-btn" class:enabled={screenSharing} class:stop={screenSharing} onclick={screenSharing ? stopScreenShare : startScreenShare} title={screenSharing ? "Parar de compartilhar" : "Compartilhar tela"}>
        {#if screenSharing}⏹{:else}🖥{/if}
      </button>
      {#if screenSharing}
        <button class="control-btn" class:enabled={isLive} class:live={isLive} onclick={toggleLive} title={isLive ? "Parar transmissão" : "Transmissão ao vivo"}>
          {#if isLive}🔴{:else}📡{/if}
        </button>
        {#if screenAudioActive}
          <div class="screen-audio-badge" title="Áudio da tela ativo">🔊</div>
        {/if}
      {/if}
    </div>
  {/if}

  {#if showLiveModal}
    <div class="modal-backdrop" onclick={() => showLiveModal = false}>
      <div class="live-modal" onclick={(e) => e.stopPropagation()}>
        <h3>Iniciar transmissão</h3>
        <input type="text" placeholder="Título da transmissão" bind:value={liveTitle} class="modal-input" />
        <input type="text" placeholder="Nome do jogo" bind:value={liveGame} class="modal-input" />
        <input type="text" placeholder="País - Idioma (ex: Brasil - PT-BR)" bind:value={liveCountry} class="modal-input" />
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick={() => showLiveModal = false}>Cancelar</button>
          <button class="btn btn-primary" onclick={startLive}>Iniciar</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .voice-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #000;
    color: #e4e6eb;
  }

  .voice-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-bottom: 1px solid #2a2b2f;
    background: #111116;
  }

  .voice-header-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .voice-icon {
    font-size: 16px;
  }

  .channel-name {
    font-size: 15px;
    font-weight: 600;
    color: #e4e6eb;
  }

  .channel-type-badge {
    font-size: 10px;
    color: #8e9297;
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    padding: 2px 8px;
    border-radius: 12px;
  }

  .join-header-btn {
    background: #0099ff;
    border: none;
    color: white;
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: background 0.15s;
  }

  .join-header-btn:hover {
    background: #0080e0;
  }

  .leave-btn {
    background: #ff454a;
    border: none;
    color: white;
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: background 0.15s;
  }

  .leave-btn:hover {
    background: #cc3338;
  }

  /* Voice Preview Container */
  .voice-preview-container {
    max-width: 600px;
    width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 24px;
    background: #111116;
    border: 1px solid #2a2b2f;
    border-radius: 16px;
    box-sizing: border-box;
  }

  .preview-header-box {
    text-align: center;
    margin-bottom: 24px;
  }

  .preview-channel-icon {
    font-size: 36px;
    margin-bottom: 8px;
  }

  .preview-header-box h3 {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 6px;
    color: #e4e6eb;
  }

  .preview-channel-desc {
    font-size: 13px;
    color: #8e9297;
    margin: 0;
  }

  .preview-channel-desc strong {
    color: #00ff88;
  }

  .preview-participants-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
    width: 100%;
    margin-bottom: 28px;
    max-height: 280px;
    overflow-y: auto;
    padding: 4px;
  }

  .preview-participant-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 10px;
  }

  .preview-card-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50% 50% 15% 50%;
    background: #2a2b2f;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    color: #0099ff;
    position: relative;
    flex-shrink: 0;
  }

  .preview-card-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50% 50% 15% 50%;
  }

  .preview-card-status {
    position: absolute;
    bottom: 4%;
    right: 4%;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid #1a1a1f;
    background: #5a5a6a;
  }

  .preview-card-status.online { background: #00ff88; }
  .preview-card-status.away { background: #ffd700; }
  .preview-card-status.dnd { background: #ff454a; }
  .preview-card-status.offline { background: #5a5a6a; }

  .preview-card-details {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .preview-card-username {
    font-size: 13px;
    font-weight: 600;
    color: #e4e6eb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .preview-card-status-text {
    font-size: 11px;
    color: #8e9297;
  }

  .preview-action-box {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .btn-connect-voice {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #0099ff;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
  }

  .btn-connect-voice:hover {
    background: #0080e0;
    transform: translateY(-1px);
  }

  .voice-user-role {
    font-size: 10px;
    color: #0099ff;
    background: #0099ff15;
    padding: 1px 6px;
    border-radius: 6px;
  }

  .voice-grid {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 16px;
    overflow-y: auto;
    min-height: 0;
    width: 100%;
    box-sizing: border-box;
  }

  .video-slot {
    position: relative;
    width: 100%;
    max-width: 640px;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    overflow: hidden;
    background: #1a1a1f;
    flex-shrink: 0;
  }

  .video-local, .video-peer, .video-screen {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .video-local {
    transform: scaleX(-1);
  }

  .cam-off-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    color: #8e9297;
    font-size: 13px;
  }

  .voice-users-grid {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 40px;
    align-content: center;
  }
  .voice-users-grid.hidden {
    display: none;
  }

  .voice-user-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .voice-user-name {
    font-size: 13px;
    font-weight: 500;
    color: #e4e6eb;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
  }

  .voice-user-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50% 50% 15% 50%;
    background: #2a2b2f;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 700;
    color: #0099ff;
    border: 2px solid #3a3b3f;
    transition: all 0.15s ease;
    position: relative;
  }

  .voice-user-avatar.local {
    border-color: #0099ff;
  }

  .voice-user-avatar.speaking {
    border-color: #00aaff;
    box-shadow: 0 0 0 3px rgba(0, 170, 255, 0.4), 0 0 20px rgba(0, 170, 255, 0.3);
    animation: pulse-speaking 1.5s ease-in-out infinite;
  }

  @keyframes pulse-speaking {
    0%, 100% { box-shadow: 0 0 0 3px rgba(0, 170, 255, 0.4), 0 0 20px rgba(0, 170, 255, 0.3); }
    50% { box-shadow: 0 0 0 5px rgba(0, 170, 255, 0.6), 0 0 30px rgba(0, 170, 255, 0.5); }
  }

  .voice-user-status {
    position: absolute;
    bottom: 4%;
    right: 4%;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 3px solid #000;
    background: #5a5a6a;
  }

  .voice-user-status.online { background: #00ff88; }
  .voice-user-status.away { background: #ffd700; }
  .voice-user-status.dnd { background: #ff454a; }
  .voice-user-status.offline { background: #5a5a6a; }

  .voice-user-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50% 50% 15% 50%;
  }

  .peer-name {
    position: absolute;
    bottom: 8px;
    left: 8px;
    background: rgba(0, 0, 0, 0.6);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
  }

  .voice-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-top: 1px solid #2a2b2f;
    background: #111116;
  }

  .screen-audio-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: #23a55a;
    color: white;
    border-radius: 50%;
    font-size: 14px;
    animation: pulse-badge 2s ease-in-out infinite;
  }

  @keyframes pulse-badge {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .control-btn {
    width: 40px;
    height: 40px;
    border: none;
    background: #2a2b2f;
    color: #8e9297;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    transition: all 0.2s;
  }

  .control-btn:hover {
    background: #3a3b3f;
  }

  .control-btn.enabled {
    background: #0099ff;
    color: white;
  }

  .control-btn.stop {
    background: #ff454a;
    color: white;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .control-btn.noise-suppression-btn.enabled {
    background: #23a55a;
    color: white;
  }

  .control-btn.live {
    background: #ff454a;
    color: white;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }

  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .live-modal {
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    padding: 24px;
    width: 320px;
  }

  .live-modal h3 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
  }

  .modal-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #2a2b2f;
    border-radius: 6px;
    background: #0f0f12;
    color: #e4e6eb;
    font-size: 14px;
    margin-bottom: 16px;
    outline: none;
  }

  .modal-input:focus {
    border-color: #0099ff;
  }

  .modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .btn {
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-secondary {
    background: transparent;
    color: #8e9297;
    border: 1px solid #2a2b2f;
  }

  .btn-primary {
    background: #0099ff;
    color: white;
    border: none;
  }
  .remote-screens {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    background: #0a0a0e;
    border-top: 1px solid #2a2b2f;
    width: 100%;
    box-sizing: border-box;
  }
  .remote-screen-container {
    position: relative;
    width: 320px;
    max-width: 320px;
    border-radius: 8px;
    overflow: hidden;
    background: #000;
    cursor: pointer;
    border: 2px solid transparent;
    padding: 0;
    transition: all 0.3s ease;
    flex: 0 0 auto;
  }
  .remote-screen-container:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }
  .remote-screen-container.featured {
    width: 100%;
    max-width: 100%;
    border-color: #0099ff;
    max-height: 70vh;
  }
  .remote-screen-container.featured .remote-screen-video {
    max-height: 70vh;
    object-fit: contain;
  }
  .remote-screen-video {
    width: 100%;
    height: auto;
    min-height: 120px;
    display: block;
    object-fit: contain;
    background: #000;
  }
  .remote-screen-container.expanded {
    border-color: #0099ff;
    min-height: 180px;
  }
  .screen-close-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.7);
    color: #e4e6eb;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    z-index: 2;
  }
  .screen-close-btn:hover {
    background: #ff453a;
    color: white;
  }
  .screen-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px 16px;
    min-height: 160px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  }
  .screen-placeholder-avatar {
    width: 56px;
    height: 56px;
  }
  .screen-placeholder-avatar img {
    width: 100%;
    height: 100%;
    border-radius: 50% 50% 15% 50%;
    object-fit: cover;
  }
  .screen-placeholder-avatar .avatar-letter {
    width: 100%;
    height: 100%;
    border-radius: 50% 50% 15% 50%;
    background: #0099ff;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 600;
  }
  .screen-placeholder-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .screen-placeholder-name {
    font-size: 13px;
    font-weight: 600;
    color: #e4e6eb;
  }
  .screen-placeholder-status {
    font-size: 11px;
    color: #8e9297;
  }
  .remote-screen-label {
    position: absolute;
    bottom: 8px;
    left: 8px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
  }
  .remote-screen-mini-preview {
    position: fixed;
    bottom: 80px;
    right: 280px;
    width: 240px;
    height: 135px;
    border-radius: 8px;
    overflow: hidden;
    background: #000;
    border: 2px solid #00ff88;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    z-index: 50;
  }
  .mini-video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    background: #000;
  }
  .mini-label {
    position: absolute;
    bottom: 6px;
    left: 6px;
    background: rgba(0, 153, 255, 0.9);
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
</style>

