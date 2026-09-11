export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  status?: 'online' | 'away' | 'do-not-disturb' | 'invisible' | 'offline' | string;
  animatedBorder?: boolean;
  accentColor?: string;
  createdAt: string;
}

export interface Server {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  ownerId: string;
  inviteCode: string;
  createdAt: string;
  bannerPosition?: 'top' | 'middle' | 'bottom';
}

export interface Category {
  id: string;
  serverId: string;
  name: string;
  position: number;
}

export interface Channel {
  id: string;
  serverId: string;
  categoryId?: string | null;
  name: string;
  type: 'text' | 'voice';
  position: number;
  topic?: string;
}

export interface ChannelWithCategory {
  channel: Channel;
  category?: Category | null;
}

export interface ServerInfo {
  server: Server;
  categories: Category[];
  channels: Channel[];
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorName?: string;
  authorAvatar?: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  senderName?: string;
  senderAvatar?: string;
}
}

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  size: number;
  mimeType: string;
  url: string;
}

export interface VoicePeer {
  userId: string;
  username: string;
  displayName: string;
}

export interface SignalOffer {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  to?: string;
  from: string;
  sdpMid?: string;
  sdpMLineIndex?: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  imageUrl?: string;
  source: string;
  url: string;
  createdAt: string;
}

export interface Friend {
  id: string;
  username: string;
  avatarUrl?: string;
  status: 'online' | 'offline' | 'away' | 'do-not-disturb' | 'invisible';
  activity?: string;
  accentColor?: string;
}

export interface LiveStream {
  id: string;
  title: string;
  streamer: Friend;
  gameName: string;
  viewerCount: number;
  durationMinutes: number;
  thumbnailUrl?: string;
  isLive: boolean;
  channelId?: string;
}

export interface ServerMember {
  userId: string;
  serverId: string;
  role: string;
  joinedAt: string;
  status?: 'online' | 'away' | 'do-not-disturb' | 'invisible' | 'offline';
  user: User;
}

export interface ServerCustomization {
  bannerPosition: 'top' | 'middle' | 'bottom';
  backgroundImage?: string;
  backgroundImagePublicId?: string;
  wallColor: string;
}
