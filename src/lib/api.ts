import { get } from 'svelte/store';
import { token } from './stores';
import type { Server, Channel, Category, Message, ServerMember } from './types';

// VITE_API_URL is set at build time for production (Tauri).
// In dev mode it's undefined, so we fall back to '/api' (Vite proxy → localhost:8080).
export const API_BASE: string = import.meta.env.VITE_API_URL || '/api';

// Strip /api suffix from API_BASE to get the origin (for WS, uploads, etc.)
function getOrigin(): string {
  if (API_BASE.startsWith('http')) {
    return API_BASE.replace(/\/api\/?$/, '');
  }
  return '';
}

// Derive WebSocket base from API URL: http→ws, https→wss
export function getWsBaseUrl(): string {
  const origin = getOrigin();
  if (origin) {
    return origin.replace(/^https/, 'wss').replace(/^http/, 'ws');
  }
  // Dev mode: relative path, derive from current page
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

export function getUploadUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  if (path.startsWith('/uploads/')) return '';
  const origin = getOrigin();
  if (origin) {
    return `${origin}${path}`;
  }
  return path;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const t = get(token);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
    ...(options.headers || {}),
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      console.log('API error:', path, err);
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (e: any) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      throw new Error('Connection timeout - server not responding');
    }
    throw e;
  }
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export { request };

export const api = {
  register: (username: string, email: string, password: string) =>
    request<{ message: string }>('/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }),

  login: (username: string, password: string) =>
    request<{ token: string; userId: string; username: string; avatarUrl?: string; status?: string }>('/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  getServers: () =>
    request<Server[]>('/servers'),

  createServer: (name: string, description?: string, iconUrl?: string) =>
    request<Server>('/servers', { method: 'POST', body: JSON.stringify({ name, description, iconUrl }) }),

  deleteServer: (serverId: string) =>
    request<{ message: string }>(`/servers/${serverId}`, { method: 'DELETE' }),

  joinChannel: (channelId: string) =>
    request<{ message: string }>(`/channels/${channelId}/join`, { method: 'POST' }),

  leaveChannel: (channelId: string) =>
    request<{ message: string }>(`/channels/${channelId}/leave`, { method: 'POST' }),

  getChannelUsers: (channelId: string) =>
    request<any[]>(`/channels/${channelId}/users`),

  searchUsers: (query: string) =>
    request<any[]>(`/users/search?q=${encodeURIComponent(query)}`),

  sendFriendRequest: (userId: string) =>
    request<{ id: string; message: string }>('/friends/requests', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  getFriendRequests: () =>
    request<any[]>('/friends/requests'),

  getSentFriendRequests: () =>
    request<any[]>('/friends/requests/sent'),

  acceptFriendRequest: (requestId: string) =>
    request<{ message: string }>(`/friends/requests/${requestId}/accept`, { method: 'POST' }),

  declineFriendRequest: (requestId: string) =>
    request<{ message: string }>(`/friends/requests/${requestId}/decline`, { method: 'POST' }),

  removeFriend: (friendId: string) =>
    request<{ message: string }>(`/friends/${friendId}`, { method: 'DELETE' }),

  getFriends: () =>
    request<any[]>('/friends'),

  getOnlineStatus: (userIds: string[]) =>
    request<Record<string, string>>('/users/online', {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    }),

  heartbeat: () =>
    request<{ message: string }>('/users/heartbeat', { method: 'POST' }),

  updateStatus: (status: string) =>
    request<{ message: string }>('/user/status', {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  getMe: () =>
    request<{ id: string; username: string; email: string; avatarUrl?: string; status?: string }>('/user/me'),

  reorderChannels: (serverId: string, channels: { id: string; position: number; categoryId?: string | null }[]) =>
    request<{ message: string }>(`/servers/${serverId}/channels/reorder`, {
      method: 'PUT',
      body: JSON.stringify(channels),
    }),

  changePassword: (userId: string, currentPassword: string, newPassword: string) =>
    request<{ message: string }>(`/users/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  sendDirectMessage: (receiverId: string, content: string) =>
    request<any>(`/messages/direct/${receiverId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  getDirectMessages: (userId: string) =>
    request<any[]>(`/messages/direct/${userId}`),

  uploadServerIcon: async (serverId: string, file: File) => {
    const t = get(token);
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/servers/${serverId}/icon`, {
      method: 'POST',
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status}`);
    }
    return res.json();
  },

  joinServer: (inviteCode: string) =>
    request<{ message: string }>('/servers/join', { method: 'POST', body: JSON.stringify({ inviteCode }) }),

  getServer: (id: string) =>
    request<Server>(`/servers/${id}`),

  getChannels: (serverId: string) =>
    request<{ categories: Category[]; channels: Channel[] }>(`/servers/${serverId}/channels`),

  getServerMembers: (serverId: string) =>
    request<ServerMember[]>(`/servers/${serverId}/members`),

  createChannel: (serverId: string, name: string, type: 'text' | 'voice', categoryId?: string, topic?: string) =>
    request<Channel>(`/servers/${serverId}/channels`, {
      method: 'POST',
      body: JSON.stringify({ name, type, categoryId, topic }),
    }),

  getMessages: (channelId: string, limit = 50) =>
    request<Message[]>(`/channels/${channelId}/messages?limit=${limit}`),

  createMessage: (channelId: string, content: string) =>
    request<Message>(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  editMessage: (messageId: string, content: string) =>
    request<Message>(`/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),

  deleteMessage: (messageId: string) =>
    request<{ message: string }>(`/messages/${messageId}`, { method: 'DELETE' }),

  uploadUserAvatar: async (file: File) => {
    const t = get(token);
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/user/avatar`, {
      method: 'POST',
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status}`);
    }
    return res.json();
  },

  uploadFile: async (channelId: string, file: File) => {
    const t = get(token);
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/channels/${channelId}/files`, {
      method: 'POST',
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status}`);
    }
    return res.json();
  },
};
