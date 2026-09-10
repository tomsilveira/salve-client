import { writable, type Writable } from 'svelte/store';
import type { User, ServerInfo, Server, Channel, Category, ChannelWithCategory, Message, Friend, LiveStream, NewsItem, ServerCustomization } from './types';

export const user: Writable<User | null> = writable(null);
export const token: Writable<string | null> = writable(null);
export const servers: Writable<Server[]> = writable([]);
export const currentServer: Writable<Server | null> = writable(null);
export const currentChannel: Writable<Channel | null> = writable(null);
export const messages: Writable<Message[]> = writable([]);
export const channelTree: Writable<{ categories: Category[]; channels: Channel[] }> = writable({ categories: [], channels: [] });
export const connectedPeers: Writable<Map<string, any>> = writable(new Map());
export const activeTab: Writable<'room' | 'friends' | 'communities' | 'lives' | 'settings'> = writable('communities');
export const friends: Writable<Friend[]> = writable([]);
export const liveStreams: Writable<LiveStream[]> = writable([]);
export const news: Writable<NewsItem[]> = writable([]);
export const serverCustomization: Writable<ServerCustomization | null> = writable(null);
export const viewMode: Writable<'tabs' | 'server'> = writable('tabs');
export const refreshMembers = writable(0);
export const globalVoiceUsers = writable<Map<string, any[]>>(new Map());
export const localVoiceStream = writable<MediaStream | null>(null);
export const activeVoiceChannel: Writable<Channel | null> = writable(null);
export const voiceLeaveFn: Writable<(() => void) | null> = writable(null);
export const remoteScreenStreams: Writable<Map<string, MediaStream>> = writable(new Map());
export const speakingUsers: Writable<Set<string>> = writable(new Set());

const storedNoiseSuppression = typeof window !== 'undefined'
  ? localStorage.getItem('salve_noise_suppression') !== 'false'
  : true;
export const noiseSuppressionEnabled: Writable<boolean> = writable(storedNoiseSuppression);
noiseSuppressionEnabled.subscribe((v) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('salve_noise_suppression', String(v));
  }
});

const storedInputDevice = typeof window !== 'undefined'
  ? localStorage.getItem('salve_input_device') || 'default'
  : 'default';
export const inputDeviceId: Writable<string> = writable(storedInputDevice);
inputDeviceId.subscribe((v) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('salve_input_device', v);
  }
});

const storedOutputDevice = typeof window !== 'undefined'
  ? localStorage.getItem('salve_output_device') || 'default'
  : 'default';
export const outputDeviceId: Writable<string> = writable(storedOutputDevice);
outputDeviceId.subscribe((v) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('salve_output_device', v);
  }
});

export const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false;
  const t = localStorage.getItem('salve_token');
  return !!t;
};

export const loadAuth = () => {
  if (typeof window !== 'undefined') {
    try {
      const t = localStorage.getItem('salve_token');
      const u = localStorage.getItem('salve_user');
      if (t) token.set(t);
      if (u) user.set(JSON.parse(u));
    } catch {
      clearAuth();
    }
  }
};

export const saveAuth = (t: string, u: User) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('salve_token', t);
    const safeUser = { id: u.id, username: u.username, email: u.email, status: u.status, createdAt: u.createdAt };
    localStorage.setItem('salve_user', JSON.stringify(safeUser));
  }
  token.set(t);
  user.set(u);
};

export const clearAuth = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('salve_token');
    localStorage.removeItem('salve_user');
  }
  token.set(null);
  user.set(null);
};
