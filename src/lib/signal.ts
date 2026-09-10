import type { SignalOffer, VoicePeer } from './types';

export class SignalClient {
  private ws: WebSocket | null = null;
  private userId: string;
  private username: string;
  private avatarUrl: string;
  private status: string;
  private accentColor: string;
  public onPeerJoined: (peer: VoicePeer) => void = () => {};
  public onPeerLeft: (userId: string) => void = () => {};
  public onSignal: (data: SignalOffer) => void = () => {};
  public onConnected: () => void = () => {};
  public onDisconnected: () => void = () => {};
  public onStatusChanged: (userId: string, status: string) => void = () => {};
  public onVoiceStateUpdated: (channelId: string, user: { id: string; username: string; avatarUrl?: string; status?: string; accentColor?: string }, joined: boolean) => void = () => {};
  public onAllVoiceStates: (states: Record<string, any[]>) => void = () => {};
  public onLiveStart: (data: { liveId: string; userId: string; username: string; avatarUrl: string; title: string; gameName: string; channelId: string }) => void = () => {};
  public onLiveStop: (liveId: string) => void = () => {};
  public onSpeaking: (channelId: string, userId: string, speaking: boolean) => void = () => {};

  private pendingMessages: any[] = [];
  private pingInterval: any = null;

  constructor(userId: string, username: string, baseUrl?: string, avatarUrl: string = '', status: string = 'online', accentColor: string = '') {
    this.userId = userId;
    this.username = username;
    this.avatarUrl = avatarUrl;
    this.status = status;
    this.accentColor = accentColor;
    const wsBase = baseUrl || (() => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}`;
    })();
    const wsUrl = `${wsBase}/ws/?userId=${this.userId}&username=${encodeURIComponent(this.username)}&avatarUrl=${encodeURIComponent(this.avatarUrl)}&status=${encodeURIComponent(this.status)}&accentColor=${encodeURIComponent(this.accentColor)}`;

    this.ws = new WebSocket(wsUrl);
    this.ws.onopen = () => {
      console.log('[Signal] connected');
      for (const msg of this.pendingMessages) {
        this.send(msg);
      }
      this.pendingMessages = [];
      this.onConnected();
      this.startHeartbeat();
    };
    this.ws.onclose = () => {
      console.log('[Signal] disconnected');
      this.stopHeartbeat();
      this.onDisconnected();
    };
    this.ws.onerror = (e) => {
      console.error('[Signal] WebSocket error', e);
    };
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('[Signal] received:', msg.type, msg.userId || msg.from || '');
        this.handleMessage(msg);
      } catch (e) {
        console.error('[Signal] parse error', e);
      }
    };
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = null;
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case 'ping':
        this.send({ type: 'pong' });
        break;
      case 'user-status-changed':
        this.onStatusChanged(msg.userId, msg.status);
        break;
      case 'voice-state-update':
        this.onVoiceStateUpdated(
          msg.target,
          {
            id: msg.userId,
            username: msg.username,
            avatarUrl: msg.avatarUrl,
            status: msg.status,
          },
          msg.joined
        );
        break;
      case 'all-voice-states':
        if (msg.states) {
          this.onAllVoiceStates(msg.states);
        }
        break;
      case 'voice-joined':
        this.onPeerJoined({
          userId: msg.userId,
          username: msg.username,
          displayName: msg.username,
        });
        break;
      case 'voice-left':
        this.onPeerLeft(msg.userId);
        break;
      case 'signal':
        if (msg.signalType) {
          this.onSignal({
            type: msg.signalType,
            data: msg.signalData,
            from: msg.from,
          });
        } else if (msg.candidate !== undefined) {
          this.onSignal({
            type: 'ice-candidate',
            data: msg.candidate,
            from: msg.from,
            sdpMid: msg.sdpMid,
            sdpMLineIndex: msg.sdpMLineIndex,
          });
        } else {
          this.onSignal({
            type: msg.offer ? 'offer' : 'answer',
            data: msg.offer || msg.answer,
            from: msg.from,
          });
        }
        break;
      case 'live-start':
        this.onLiveStart({
          liveId: msg.liveId,
          userId: msg.userId,
          username: msg.username,
          avatarUrl: msg.avatarUrl || '',
          title: msg.title,
          gameName: msg.gameName || 'Geral',
          channelId: msg.channelId,
        });
        break;
      case 'live-stop':
        this.onLiveStop(msg.liveId);
        break;
      case 'speaking':
        this.onSpeaking(msg.target, msg.userId, msg.speaking);
        break;
    }
  }

  updateStatus(status: string) {
    this.status = status;
    this.send({ type: 'status-update', status });
  }

  getVoiceStates() {
    this.send({ type: 'get-voice-states' });
  }

  send(msg: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[Signal] sending:', msg.type, msg.target || '');
      this.ws.send(JSON.stringify(msg));
    } else {
      // Queue message for when connection opens
      this.pendingMessages.push(msg);
    }
  }

  sendPing() {
    this.send({ type: 'ping' });
  }

  joinVoice(channelId: string) {
    this.send({ type: 'voice-join', target: channelId });
  }

  leaveVoice(channelId: string) {
    this.send({ type: 'voice-leave', target: channelId });
  }

  sendSpeaking(channelId: string, speaking: boolean) {
    this.send({ type: 'speaking', target: channelId, speaking });
  }

  sendSignal(to: string, channelId: string, signal: any) {
    const msg: any = { type: 'signal', target: channelId, to, from: this.userId };
    if (signal.type === 'offer') msg.offer = signal.offer;
    else if (signal.type === 'answer') msg.answer = signal.answer;
    else if (signal.type === 'rtp-ice-candidate') {
      msg.candidate = signal.candidate.candidate;
      msg.sdpMid = signal.candidate.sdpMid;
      msg.sdpMLineIndex = signal.candidate.sdpMLineIndex;
    } else {
      msg.signalType = signal.type;
      msg.signalData = signal.data ?? null;
    }
    this.send(msg);
  }

  startLive(liveId: string, title: string, gameName: string, channelId: string) {
    this.send({
      type: 'live-start',
      liveId,
      title,
      gameName,
      channelId,
    });
  }

  stopLive(liveId: string) {
    this.send({
      type: 'live-stop',
      liveId,
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
