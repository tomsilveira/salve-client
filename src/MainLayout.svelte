<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { api, getUploadUrl, getAvatarDisplayUrl } from './lib/api';
  import { user, servers, currentServer, currentChannel, channelTree, connectedPeers, viewMode, refreshMembers, globalVoiceUsers, activeVoiceChannel as activeVoiceChannelStore, voiceLeaveFn, liveStreams } from './lib/stores';
  import type { Server, Channel, Category, Message, ServerMember } from './lib/types';
  import { SignalClient } from './lib/signal';
  import ServerList from './ServerList.svelte';
  import ChannelList from './ChannelList.svelte';
  import MessageList from './MessageList.svelte';
  import MessageInput from './MessageInput.svelte';
  import VoicePanel from './VoicePanel.svelte';
  import UserPanel from './UserPanel.svelte';
  import CreateServerModal from './CreateServerModal.svelte';
  import InviteFriendsModal from './InviteFriendsModal.svelte';

  let selectedServer: Server | null = $state(null);
  let selectedChannel: Channel | null = $state(null);
  let showCreateModal = $state(false);
  let showCreateChannelModal = $state(false);
  let showInviteModal = $state(false);
  let messages = $state<Message[]>([]);
  let newChannelName = $state('');
  let newChannelType = $state('text');
  let showUserPanel = $state(false);
  let serverList: Server[] = $state([]);
  let categories: Category[] = $state([]);
  let channels: Channel[] = $state([]);
  let members: ServerMember[] = $state([]);
  let onlineCount = $state(0);
  let activeVoiceChannel: Channel | null = $state(null);
  let signalClient: SignalClient | null = $state(null);
  const { onBack = () => {} } = $props();
  servers.subscribe((s) => { serverList = s; });
  currentServer.subscribe((s) => { selectedServer = s; });
  currentChannel.subscribe((c) => { selectedChannel = c; });
  channelTree.subscribe((ct) => { categories = ct.categories; channels = ct.channels; });

  const voiceUsers = $derived($globalVoiceUsers);

  function initGlobalSignal() {
    const u = get(user);
    if (!u) return;
    if (signalClient) return;

    signalClient = new SignalClient(u.id, u.username, getWsUrl(), u.avatarUrl || '', u.status || 'online');

    signalClient.onConnected = () => {
      console.log('[MainLayout] WebSocket connected, requesting voice states');
      signalClient?.getVoiceStates();
    };

    signalClient.onStatusChanged = (uid: string, newStatus: string) => {
      console.log('[MainLayout] status changed:', uid, newStatus);
      members = members.map((m) =>
        m.userId === uid ? { ...m, status: newStatus as any, user: { ...m.user, status: newStatus } } : m
      );
      if (uid === currentUserId) {
        user.update((curr) => (curr ? { ...curr, status: newStatus } : null));
      }
    };

    signalClient.onVoiceStateUpdated = (channelId: string, voiceUser: any, isJoin: boolean) => {
      console.log('[MainLayout] voice state update:', channelId, voiceUser.username, isJoin);
      globalVoiceUsers.update((map) => {
        const newMap = new Map(map);
        const currentList = newMap.get(channelId) || [];
        if (isJoin) {
          if (!currentList.some((u: any) => u.id === voiceUser.id)) {
            newMap.set(channelId, [...currentList, voiceUser]);
          }
        } else {
          newMap.set(channelId, currentList.filter((u: any) => u.id !== voiceUser.id));
        }
        return newMap;
      });
    };

    signalClient.onAllVoiceStates = (states: Record<string, any[]>) => {
      console.log('[MainLayout] all voice states:', states);
      const newMap = new Map<string, any[]>();
      for (const [chId, uList] of Object.entries(states)) {
        newMap.set(chId, uList);
      }
      globalVoiceUsers.set(newMap);
    };

    signalClient.onPeerJoined = (peer) => {
      console.log('[MainLayout] Peer joined voice:', peer.username, peer.userId);
      connectedPeers.update((m) => {
        const newMap = new Map(m);
        newMap.set(peer.userId, peer);
        return newMap;
      });
    };

    signalClient.onPeerLeft = (uid: string) => {
      console.log('[MainLayout] Peer left voice:', uid);
      connectedPeers.update((m) => {
        const newMap = new Map(m);
        newMap.delete(uid);
        return newMap;
      });
    };

    signalClient.onLiveStart = (data) => {
      console.log('[MainLayout] onLiveStart:', data.username, data.title);
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
      console.log('[MainLayout] onLiveStop:', liveId);
      liveStreams.update((streams) => streams.filter(s => s.id !== liveId));
    };
  }

  onMount(() => {
    loadServers();
    initGlobalSignal();

    const handleBeforeUnload = () => {
      if (activeVoiceChannel) {
        // Use sendBeacon for reliable cleanup on page close
        const token = localStorage.getItem('salve_token');
        if (token) {
          const url = `/api/channels/${activeVoiceChannel.id}/leave`;
          const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        }
        signalClient?.leaveVoice(activeVoiceChannel.id);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });

  function getWsUrl(): string {
    const apiBase = import.meta.env.VITE_API_URL;
    if (apiBase) {
      const origin = apiBase.replace(/\/api\/?$/, '');
      return origin.replace(/^https/, 'wss').replace(/^http/, 'ws');
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  async function loadServers() {
    try {
      serverList = await api.getServers();
      servers.set(serverList);
    } catch (e) {
      console.error('Failed to load servers', e);
    }
  }

  async function handleServerSelect(server: Server) {
    selectedServer = server;
    currentServer.set(server);
    try {
      const result = await api.getChannels(server.id);
      const loadedChannels = result.channels || [];
      channelTree.set({
        categories: result.categories || [],
        channels: loadedChannels,
      });

      // Load voice users for all voice channels in server
      loadedChannels.forEach((ch) => {
        if (ch.type === 'voice') {
          loadVoiceUsers(ch.id);
        }
      });
    } catch (e) {
      console.error('Failed to load channels', e);
      channelTree.set({ categories: [], channels: [] });
    }
    try {
      members = await api.getServerMembers(server.id);
      onlineCount = members.length;
    } catch (e) {
      console.error('Failed to load members', e);
      members = [];
      onlineCount = 0;
    }
  }

  async function handleChannelSelect(channel: Channel) {
    console.log('handleChannelSelect called:', channel.name, channel.type);
    messages = [];
    selectedChannel = channel;
    currentChannel.set(channel);

    if (channel.type === 'text') {
      try {
        const loaded = await api.getMessages(channel.id, 50);
        messages = loaded || [];
      } catch (e) {
        console.error('Failed to load messages', e);
        messages = [];
      }
    } else if (channel.type === 'voice') {
      try {
        const loaded = await api.getMessages(channel.id, 50);
        messages = loaded || [];
      } catch (e) {
        console.error('Failed to load messages', e);
        messages = [];
      }
      // Load current voice users for this channel
      await loadVoiceUsers(channel.id);
    }
    // Always load voice users when switching channels to keep data fresh
    if (channel.type === 'voice') {
      await loadVoiceUsers(channel.id);
    }
  }

  async function loadVoiceUsers(channelId: string) {
    try {
      const users = await api.getChannelUsers(channelId);
      console.log('loadVoiceUsers result:', channelId, users);
      globalVoiceUsers.update((map) => {
        const newMap = new Map(map);
        newMap.set(channelId, users || []);
        return newMap;
      });
    } catch (e) {
      console.error('Failed to load voice users', e);
    }
  }

  function handleJoinVoice(channel: Channel) {
    const u = get(user);
    if (!u) return;

    // Leave current voice channel first if switching
    if (activeVoiceChannel && activeVoiceChannel.id !== channel.id) {
      handleLeaveVoice();
    }

    if (!signalClient) {
      initGlobalSignal();
    }

    connectedPeers.set(new Map());
    activeVoiceChannel = channel;
    activeVoiceChannelStore.set(channel);
    selectedChannel = channel;
    currentChannel.set(channel);

    signalClient?.joinVoice(channel.id);
    api.joinChannel(channel.id);
    loadVoiceUsers(channel.id);

    voiceLeaveFn.set(() => {
      handleLeaveVoice();
    });
  }

  function handleLeaveVoice() {
    if (activeVoiceChannel) {
      signalClient?.leaveVoice(activeVoiceChannel.id);
      api.leaveChannel(activeVoiceChannel.id);
    }
    activeVoiceChannel = null;
    activeVoiceChannelStore.set(null);
    voiceLeaveFn.set(null);
    connectedPeers.set(new Map());
  }

  function handleMessageSent(msg: Message) {
    if (!messages) messages = [];
    messages.push(msg);
  }

  async function handleEditMessage(messageId: string, content: string) {
    try {
      const updated = await api.editMessage(messageId, content);
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx !== -1) messages[idx] = updated;
    } catch (e) {
      console.error('Failed to edit message', e);
    }
  }

  async function handleDeleteMessage(messageId: string) {
    try {
      await api.deleteMessage(messageId);
      messages = messages.filter((m) => m.id !== messageId);
    } catch (e) {
      console.error('Failed to delete message', e);
    }
  }

  function handleCreateChannel(data: { name: string; type: 'text' | 'voice' }) {
    if (!selectedServer) return;
    api.createChannel(selectedServer.id, data.name, data.type)
      .then((newCh: Channel) => {
        channels = [...channels, newCh];
        channelTree.set({ categories, channels });
      })
      .catch((e) => console.error('Failed to create channel', e));
  }

  function handleReorderChannels(newChannels: Channel[]) {
    channels = newChannels;
    channelTree.set({ categories, channels });
    if (selectedServer) {
      api.reorderChannels(
        selectedServer.id,
        newChannels.map((c, idx) => ({ id: c.id, position: idx, categoryId: c.categoryId }))
      ).catch((e) => console.error('Failed to persist channel order', e));
    }
  }

  onDestroy(() => {
    if (signalClient) {
      signalClient.disconnect();
      signalClient = null;
    }
  });

  let serverImageFile: File | null = null;
  let uploadingServerImage = false;

  function handleServerImageChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      serverImageFile = input.files[0];
      uploadServerImage();
    }
  }

  async function uploadServerImage() {
    if (!serverImageFile || !selectedServer) return;
    uploadingServerImage = true;
    try {
      const res = await api.uploadServerIcon(selectedServer.id, serverImageFile);
      selectedServer = { ...selectedServer, iconUrl: res.iconUrl };
      currentServer.set(selectedServer);
      serverImageFile = null;
    } catch (e) {
      console.error('Failed to upload server image', e);
    } finally {
      uploadingServerImage = false;
    }
  }

  const isServerOwner = $derived(selectedServer && $user && selectedServer.ownerId === $user.id);
  const isJoinedVoice = $derived(!!(activeVoiceChannel && selectedChannel && activeVoiceChannel.id === selectedChannel.id));
  const currentUserId = $derived($user?.id || '');

  function getMemberStatus(member: ServerMember): string {
    if (member.userId === currentUserId) {
      const userStatus = get(user)?.status || 'online';
      // If user is in voice and their status is online, show online
      if (isJoinedVoice && userStatus === 'online') return 'online';
      // Otherwise show their chosen status
      return userStatus;
    }
    return member.status || 'offline';
  }

  $effect(() => {
    if (selectedServer) {
      get(refreshMembers);
      api.getServerMembers(selectedServer.id).then((m) => {
        members = m;
        onlineCount = m.length;
      }).catch((e) => {
        console.error('Failed to load members', e);
        members = [];
        onlineCount = 0;
      });
    }
  });
</script>

<div class="app-container">
  {#if !selectedServer}
    <ServerList
      {serverList}
      {selectedServer}
      currentUser={$user}
      {members}
      showBack={true}
      onselect={handleServerSelect}
      oncreate={() => (showCreateModal = true)}
      ontoggleUserPanel={() => (showUserPanel = true)}
      onback={onBack}
    />
  {/if}

  {#if selectedServer}
    <!-- BANNER COLUMN: Banner + User Card + Members -->
    <div class="banner-column">
      <div class="server-banner">
        {#if selectedServer.iconUrl}
          <img class="server-banner-img" src={getUploadUrl(selectedServer.iconUrl)} alt={selectedServer.name} />
        {:else}
          <div class="server-banner-placeholder">{selectedServer.name?.[0]?.toUpperCase() || '?'}</div>
        {/if}
        <div class="banner-top-btns">
          <button class="banner-btn" onclick={onBack} title="Voltar">←</button>
          <div class="banner-top-right">
            {#if isServerOwner}
              <label class="banner-btn" title="Alterar imagem">
                <input type="file" accept="image/*" onchange={handleServerImageChange} hidden />
                {#if uploadingServerImage}↻{:else}📷{/if}
              </label>
            {/if}
            <button class="banner-btn" title="Convidar" onclick={() => (showInviteModal = true)}>🔗</button>
          </div>
        </div>
        <div class="banner-info">
          <h2 class="banner-server-name">{selectedServer.name}</h2>
          {#if selectedServer.description}
            <p class="banner-server-desc">{selectedServer.description}</p>
          {/if}
          <span class="banner-online">{onlineCount} online</span>
        </div>
      </div>

      <div class="sidebar-user-card" onclick={() => (showUserPanel = true)}>
        <div class="sidebar-user-avatar">
          {#if $user?.avatarUrl}
            <img src="{getAvatarDisplayUrl($user.avatarUrl)}" alt={$user.username} />
          {:else}
            <span>{$user?.username?.[0]?.toUpperCase() || '?'}</span>
          {/if}
          <div class="sidebar-user-status" class:online={$user?.status === 'online' || !$user?.status} class:away={$user?.status === 'away'} class:dnd={$user?.status === 'do-not-disturb'}></div>
        </div>
        <div class="sidebar-user-info">
          <span class="sidebar-user-name">{$user?.username || 'User'}</span>
          <span class="sidebar-user-status-text">{$user?.status === 'do-not-disturb' ? 'Ocupado' : $user?.status === 'away' ? 'Ausente' : 'Online'}</span>
        </div>
      </div>

      <div class="sidebar-members-section">
        <div class="sidebar-members-header">MEMBROS - {members.length}</div>
        {#each members as member (member.userId)}
          <div class="sidebar-member">
            <div class="sidebar-member-avatar">
              {#if member.user?.avatarUrl}
                <img src="{getUploadUrl(member.user.avatarUrl)}?t={Date.now()}" alt={member.user.username} />
              {:else}
                <span>{member.user?.username?.[0]?.toUpperCase() || '?'}</span>
              {/if}
              <div class="sidebar-member-status" class:online={getMemberStatus(member) === 'online'} class:away={getMemberStatus(member) === 'away'} class:dnd={getMemberStatus(member) === 'do-not-disturb'}></div>
            </div>
            <span class="sidebar-member-name">{member.user?.username || 'Unknown'}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- CHANNELS COLUMN -->
    <div class="channels-column">
      <ChannelList
        server={selectedServer}
        {categories}
        {channels}
        {selectedChannel}
        {activeVoiceChannel}
        {voiceUsers}
        onSelect={handleChannelSelect}
        onJoinVoice={handleJoinVoice}
        onCreateChannel={handleCreateChannel}
        onReorder={handleReorderChannels}
      />
    </div>

    <!-- RIGHT COLUMN: Member Cards + Chat -->
    <div class="right-column">
      <div class="user-cards">
        <div class="user-cards-header">
          {#if selectedChannel?.type === 'voice'}
            <span>Na sala — {(voiceUsers.get(selectedChannel?.id || '') || []).length}</span>
          {:else}
            <span>Membros — {members.length}</span>
          {/if}
        </div>
        <div class="user-cards-list">
          {#if selectedChannel?.type === 'voice'}
            {#each (voiceUsers.get(selectedChannel?.id || '') || []) as voiceUser (voiceUser.id)}
              <div class="user-card">
                <div class="user-card-avatar">
                  {#if voiceUser.avatarUrl}
                    <img src="{getAvatarDisplayUrl(voiceUser.avatarUrl)}" alt={voiceUser.username} />
                  {:else}
                    <span>{voiceUser.username?.[0]?.toUpperCase() || '?'}</span>
                  {/if}
                  <div class="user-status-dot" class:online={voiceUser.status === 'online'} class:away={voiceUser.status === 'away'} class:dnd={voiceUser.status === 'do-not-disturb'} class:offline={voiceUser.status === 'offline' || voiceUser.status === 'invisible'}></div>
                </div>
                <div class="user-card-info">
                  <span class="user-card-name">{voiceUser.username || 'Unknown'}</span>
                  <span class="user-card-role">{voiceUser.status || 'online'}</span>
                </div>
              </div>
            {/each}
          {:else}
            {#each members as member (member.userId)}
              <div class="user-card">
                <div class="user-card-avatar">
                   {#if member.user?.avatarUrl}
                <img src="{getAvatarDisplayUrl(member.user.avatarUrl)}" alt={member.user.username} />
                   {:else}
                     <span>{member.user?.username?.[0]?.toUpperCase() || '?'}</span>
                   {/if}
                   <div class="user-status-dot" class:online={getMemberStatus(member) === 'online'} class:away={getMemberStatus(member) === 'away'} class:dnd={getMemberStatus(member) === 'do-not-disturb'} class:offline={getMemberStatus(member) === 'invisible' || getMemberStatus(member) === 'offline'}></div>
                </div>
                <div class="user-card-info">
                  <span class="user-card-name">{member.user?.username || 'Unknown'}</span>
                  <span class="user-card-role">{member.role}</span>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <main class="main-content">
        {#if selectedChannel && selectedChannel.type === 'text'}
          <MessageList {messages} {selectedChannel} currentUser={$user} onEdit={handleEditMessage} onDelete={handleDeleteMessage} />
          <MessageInput channelId={selectedChannel?.id || ''} onSend={handleMessageSent} />
        {:else if selectedChannel && selectedChannel.type === 'voice'}
          <div class="voice-full">
            <VoicePanel
              channel={selectedChannel}
              userId={$user?.id || ''}
              username={$user?.username || ''}
              signalClient={signalClient}
              onLeave={handleLeaveVoice}
              onJoin={handleJoinVoice}
              {members}
              joined={isJoinedVoice}
              currentUser={$user}
              voiceUsers={voiceUsers.get(selectedChannel.id) || []}
            />
            <div class="voice-text-chat">
              <MessageList messages={messages} {selectedChannel} currentUser={$user} onEdit={handleEditMessage} onDelete={handleDeleteMessage} />
              <MessageInput channelId={selectedChannel?.id || ''} onSend={handleMessageSent} />
            </div>
          </div>
        {:else}
          <div class="no-channel">
            <p>Selecione um canal ou crie um novo</p>
          </div>
        {/if}

        {#if activeVoiceChannel && selectedChannel && selectedChannel.type === 'text'}
          <div class="voice-sidebar">
            <VoicePanel
              channel={activeVoiceChannel}
              userId={$user?.id || ''}
              username={$user?.username || ''}
              signalClient={signalClient}
              onLeave={handleLeaveVoice}
              onJoin={handleJoinVoice}
              {members}
              joined={true}
              currentUser={$user}
              voiceUsers={voiceUsers.get(activeVoiceChannel.id) || []}
            />
          </div>
        {/if}
      </main>
    </div>
  {:else}
    <div class="no-server">
      <div class="no-server-content">
        <span class="no-server-icon">💬</span>
        <h2>Bem-vindo ao Salve</h2>
        <p>Selecione uma comunidade para começar</p>
      </div>
    </div>
  {/if}

  {#if showUserPanel && $user}
    <UserPanel user={$user} {signalClient} onClose={() => (showUserPanel = false)} />
  {/if}

  {#if showCreateModal}
    <CreateServerModal
      on:close={() => (showCreateModal = false)}
      on:create={async (event: CustomEvent) => {
        const { name, description, iconFile } = event.detail;
        try {
          const srv = await api.createServer(name, description);
          if (iconFile) {
            try {
              const res = await api.uploadServerIcon(srv.id, iconFile);
              srv.iconUrl = res.iconUrl;
            } catch (e) {
              console.error('Icon upload failed', e);
            }
          }
          try {
            await api.createChannel(srv.id, 'Bate-Papo', 'text');
          } catch (e) {
            console.error('Failed to create default channel', e);
          }
          serverList = [...serverList, srv];
          servers.set(serverList);
          showCreateModal = false;
        } catch (e) {
          console.error('Failed to create server', e);
        }
      }}
    />
  {/if}

  {#if showCreateChannelModal}
    <div class="modal-backdrop" onclick={() => showCreateChannelModal = false}>
      <div class="create-modal" onclick={(e) => e.stopPropagation()}>
        <h3>Criar canal</h3>
        <input type="text" placeholder="Nome do canal" bind:value={newChannelName} class="modal-input" />
        <div class="type-selector">
          <label><input type="radio" bind:group={newChannelType} value="text" /> Texto</label>
          <label><input type="radio" bind:group={newChannelType} value="voice" /> Voz</label>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick={() => showCreateChannelModal = false}>Cancelar</button>
          <button class="btn btn-primary" onclick={() => { handleCreateChannel({ name: newChannelName, type: newChannelType as 'text' | 'voice' }); showCreateChannelModal = false; newChannelName = ''; }}>Criar</button>
        </div>
      </div>
    </div>
  {/if}
</div>

{#if showInviteModal && selectedServer}
  <InviteFriendsModal server={selectedServer} onClose={() => (showInviteModal = false)} />
{/if}

<style>
  .app-container {
    display: flex;
    height: 100%;
    background: #0f0f12;
    color: #e4e6eb;
    overflow: hidden;
  }

  .banner-column {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: #111116;
    border-right: 1px solid #2a2b2f;
    overflow-y: auto;
  }

  .server-banner {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 5;
    overflow: hidden;
    flex-shrink: 0;
  }

  .server-banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .server-banner-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
    font-weight: 700;
    color: #0099ff;
  }

  .banner-top-btns {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    z-index: 2;
  }

  .banner-top-right {
    display: flex;
    gap: 6px;
  }

  .banner-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
    transition: background 0.2s;
  }

  .banner-btn:hover {
    background: rgba(0, 0, 0, 0.85);
  }

  .banner-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 16px 14px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(2px);
  }

  .banner-server-name {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 2px;
    color: white;
  }

  .banner-server-desc {
    font-size: 12px;
    color: #ccc;
    margin: 0 0 4px;
  }

  .banner-online {
    font-size: 12px;
    color: #aaa;
  }

  .sidebar-user-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    margin: 0;
    background: #1a1a1f;
    border-bottom: 1px solid #2a2b2f;
    cursor: pointer;
    transition: background 0.15s;
  }

  .sidebar-user-card:hover {
    background: #22222a;
  }

  .sidebar-user-avatar {
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: 50% 50% 15% 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: #2a2b2f;
  }

  .sidebar-user-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .sidebar-user-avatar span {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    color: #0099ff;
  }

  .sidebar-user-status {
    position: absolute;
    bottom: 4%;
    right: 4%;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid #1a1a1f;
    background: #5a5a6a;
  }

  .sidebar-user-status.online { background: #00ff88; }
  .sidebar-user-status.away { background: #ffd700; }
  .sidebar-user-status.dnd { background: #ff454a; }

  .sidebar-user-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .sidebar-user-name {
    font-size: 13px;
    font-weight: 600;
    color: #e4e6eb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-user-status-text {
    font-size: 11px;
    color: #8e9297;
  }

  .sidebar-members-section {
    padding: 12px 14px;
  }

  .sidebar-members-header {
    font-size: 11px;
    font-weight: 600;
    color: #8e9297;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
  }

  .sidebar-member {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
  }

  .sidebar-member-avatar {
    position: relative;
    width: 32px;
    height: 32px;
    border-radius: 50% 50% 15% 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: #2a2b2f;
  }

  .sidebar-member-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .sidebar-member-avatar span {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    color: #0099ff;
  }

  .sidebar-member-status {
    position: absolute;
    bottom: 4%;
    right: 4%;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid #111116;
    background: #5a5a6a;
  }

  .sidebar-member-status.online { background: #00ff88; }
  .sidebar-member-status.away { background: #ffd700; }
  .sidebar-member-status.dnd { background: #ff454a; }

  .sidebar-member-name {
    font-size: 13px;
    color: #e4e6eb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .channels-column {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #2a2b2f;
    background: #111116;
  }

  .right-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
  .create-modal { background: #1a1a1f; border: 1px solid #2a2b2f; border-radius: 12px; padding: 24px; width: 320px; }
  .create-modal h3 { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
  .modal-input { width: 100%; padding: 8px 12px; border: 1px solid #2a2b2f; border-radius: 6px; background: #0f0f12; color: #e4e6eb; font-size: 14px; margin-bottom: 16px; outline: none; }
  .modal-input:focus { border-color: #0099ff; }
  .type-selector { display: flex; gap: 16px; margin-bottom: 20px; }
  .type-selector label { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .btn { padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; }
  .btn-secondary { background: transparent; color: #8e9297; border: 1px solid #2a2b2f; }
  .btn-primary { background: #0099ff; color: white; border: none; }

  .icon-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: #8e9297;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  }

  .icon-btn:hover {
    background: #22222a;
    color: #e4e6eb;
  }

  .right-column {
    width: 75%;
    display: flex;
    flex-direction: column;
  }

  .user-cards {
    border-bottom: 1px solid #2a2b2f;
    background: #111116;
    max-height: 200px;
    overflow-y: auto;
  }

  .user-cards-header {
    padding: 12px 16px 8px;
    font-size: 12px;
    font-weight: 600;
    color: #8e9297;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    position: sticky;
    top: 0;
    background: #111116;
  }

  .user-cards-list {
    padding: 0 12px 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .user-card {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 8px;
    transition: border-color 0.2s;
  }

  .user-card:hover {
    border-color: #0099ff;
  }

  .user-card-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50% 50% 15% 50%;
    background: #2a2b2f;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    color: #0099ff;
    overflow: hidden;
    flex-shrink: 0;
    position: relative;
  }

  .user-card-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .user-status-dot {
    position: absolute;
    bottom: 4%;
    right: 4%;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid #1a1a1f;
    background: #5a5a6a;
  }

  .user-status-dot.online { background: #00ff88; }
  .user-status-dot.away { background: #ffd700; }
  .user-status-dot.dnd { background: #ff454a; }
  .user-status-dot.offline { background: #5a5a6a; }

  .user-card-info {
    display: flex;
    flex-direction: column;
  }

  .user-card-name {
    font-size: 13px;
    font-weight: 500;
  }

  .user-card-role {
    font-size: 10px;
    color: #8e9297;
    text-transform: capitalize;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .voice-full {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .voice-text-chat {
    border-top: 1px solid #2a2b2f;
    background: #0f0f12;
    display: flex;
    flex-direction: column;
    max-height: 200px;
    min-height: 150px;
  }

  .voice-with-chat {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .text-chat-sidebar {
    border-top: 1px solid #2a2b2f;
    background: #0f0f12;
    display: flex;
    flex-direction: column;
    max-height: 200px;
  }

  .voice-users-header {
    font-size: 11px;
    font-weight: 600;
    color: #8e9297;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .voice-users-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .voice-user-card {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 6px;
  }

  .voice-user-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50% 50% 15% 50%;
    background: #2a2b2f;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    color: #0099ff;
  }

  .voice-user-name {
    font-size: 12px;
    color: #e4e6eb;
  }

  .no-channel {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #8e9297;
    font-size: 14px;
  }

  .no-server {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .no-server-content {
    text-align: center;
    color: #8e9297;
  }

  .no-server-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 16px;
  }

  .no-server-content h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px;
    color: #e4e6eb;
  }

  .no-server-content p {
    font-size: 14px;
    margin: 0;
  }
</style>
