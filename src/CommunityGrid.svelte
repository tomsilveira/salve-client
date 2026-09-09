<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { api, getUploadUrl } from './lib/api';
import { servers, currentServer, currentChannel, channelTree, viewMode, friends, user } from './lib/stores';
import type { Server, Friend, ServerMember } from './lib/types';
import CreateServerModal from './CreateServerModal.svelte';

let serverList = $derived($servers);
const friendList = $derived($friends);
  let showCreateModal = $state(false);
  let hoveredServer: Server | null = $state(null);
  let errorMessage = $state('');
  const serverMembers: Record<string, ServerMember[]> = {};
  const loadingMembers: Record<string, boolean> = {};

  async function loadServerMembers(serverId: string) {
    if (serverMembers[serverId] || loadingMembers[serverId]) return;
    loadingMembers[serverId] = true;
    try {
      const members = await api.getServerMembers(serverId);
      serverMembers[serverId] = members;
    } catch (e) {
      console.error('Failed to load members', e);
    } finally {
      loadingMembers[serverId] = false;
    }
  }

  onMount(() => {
    loadServers();
    loadFriendsFromDB();
  });

  async function loadFriendsFromDB() {
    try {
      const dbFriends = await api.getFriends();
      if (dbFriends && dbFriends.length > 0) {
        const mapped: Friend[] = dbFriends.map((u: any) => ({
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl || u.avatar_url || '',
          status: u.status || 'offline',
          activity: '',
        }));
        friends.set(mapped);
      }
    } catch (e) {
      console.error('Failed to load friends', e);
    }
  }

  async function loadServers() {
    try {
      const list = await api.getServers();
      servers.set(list);
    } catch (e) {
      console.error('Failed to load servers', e);
    }
  }

  function handleServerClick(server: Server) {
    console.log('Entering server:', server.name);
    currentServer.set(server);
    viewMode.set('server');
    api.getChannels(server.id).then((result) => {
      channelTree.set({
        categories: result.categories || [],
        channels: result.channels || [],
      });
    });
    api.getServerMembers(server.id).then((members) => {
      serverMembers[server.id] = members;
    }).catch((e) => console.error('Failed to load members', e));
  }

  async function handleDeleteServer(server: Server, e: Event) {
    e.stopPropagation();
    if (confirm(`Deletar servidor "${server.name}"?`)) {
      try {
        await api.deleteServer(server.id);
        serverList = serverList.filter((s) => s.id !== server.id);
        servers.set(serverList);
      } catch (err: any) {
        console.error('Failed to delete server', err);
        errorMessage = err.message || 'Falha ao deletar servidor';
      }
    }
  }

  async function handleCreateServer(data: { name: string; description: string; iconFile: File | null }) {
    const { name, description, iconFile } = data;
    errorMessage = '';
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
      srv.bannerPosition = 'bottom';
      serverList = [...serverList, srv];
      servers.set(serverList);
      showCreateModal = false;
    } catch (e: any) {
      console.error('Failed to create server', e);
      errorMessage = e.message || 'Falha ao criar servidor';
    }
  }
</script>

<div class="community-page">
  <div class="community-main">
    <div class="community-header">
      <h2>Comunidades</h2>
      <button class="btn-create" onclick={() => (showCreateModal = true)}>
        + Criar comunidade
      </button>
    </div>

    {#if errorMessage}
      <div class="error-banner">{errorMessage}</div>
    {/if}

    <div class="community-grid">
      {#if serverList.length === 0}
      <div
        class="community-card placeholder-card"
        onclick={() => (showCreateModal = true)}
      >
        <div class="placeholder-content">
          <span class="placeholder-icon">+</span>
          <span class="placeholder-text">Criar nova comunidade</span>
        </div>
      </div>
      {/if}

      {#each serverList as server (server.id)}
        <div class="card-wrapper">
          <div
            class="community-card"
            onclick={() => handleServerClick(server)}
            onmouseenter={() => { hoveredServer = server; loadServerMembers(server.id); }}
            onmouseleave={() => (hoveredServer = null)}
          >
            <div class="card-image">
              {#if server.iconUrl}
                <img src={getUploadUrl(server.iconUrl)} alt={server.name} class="server-image" />
              {:else}
                <div class="server-placeholder">{server.name?.[0]?.toUpperCase() || '?'}</div>
              {/if}
            </div>

            {#if hoveredServer?.id === server.id}
              <div class="card-overlay">
                <button class="overlay-btn delete-btn" title="Deletar" onclick={(e) => { e.stopPropagation(); handleDeleteServer(server, e); }}>🗑</button>
              </div>
            {/if}

            {#if hoveredServer?.id === server.id && serverMembers[server.id] && serverMembers[server.id].length > 0 && false}
              <div class="card-members">
                {#each serverMembers[server.id].slice(0, 15) as member (member.userId)}
                  <div class="member-avatar" title={member.user?.username}>
                    {#if member.user?.avatarUrl}
                      <img src={getUploadUrl(member.user.avatarUrl)} alt={member.user.username} />
                    {:else}
                      <span>{member.user?.username?.[0]?.toUpperCase() || '?'}</span>
                    {/if}
                  </div>
                {/each}
                {#if serverMembers[server.id].length > 15}
                  <div class="member-avatar member-more">⋯</div>
                {/if}
              </div>
            {/if}
          </div>
          <div class="card-tab">
            <span class="tab-text">{server.name}</span>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <div class="friends-sidebar">
    {#if $user}
      <div class="user-card">
        <div class="user-card-avatar">
          {#if $user.avatarUrl}
            <img src={getUploadUrl($user.avatarUrl)} alt={$user.username} />
          {:else}
            <span>{$user.username?.[0]?.toUpperCase() || '?'}</span>
          {/if}
          <div class="user-card-status" class:online={$user.status === 'online'} class:away={$user.status === 'away'} class:dnd={$user.status === 'do-not-disturb'} class:offline={$user.status === 'offline' || $user.status === 'invisible'}></div>
        </div>
        <div class="user-card-info">
          <span class="user-card-name">{$user.username}</span>
          <span class="user-card-email">{$user.email}</span>
        </div>
      </div>
    {/if}
    <div class="friends-divider">
      <span>Amigos — {friendList.length}</span>
    </div>
    <div class="friends-list">
      {#each friendList as friend (friend.id)}
        <div class="friend-card">
          <div class="friend-avatar">
            {#if friend.avatarUrl}
              <img src={getUploadUrl(friend.avatarUrl)} alt={friend.username} />
            {:else}
              <span>{friend.username?.[0]?.toUpperCase() || '?'}</span>
            {/if}
            <div class="friend-status" class:online={friend.status === 'online'} class:away={friend.status === 'away'} class:dnd={friend.status === 'do-not-disturb'} class:offline={friend.status === 'offline' || friend.status === 'invisible'}></div>
          </div>
          <div class="friend-info">
            <span class="friend-name">{friend.username}</span>
            {#if friend.activity}
              <span class="friend-activity">{friend.activity}</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

{#if showCreateModal}
  <CreateServerModal
    onclose={() => (showCreateModal = false)}
    oncreate={handleCreateServer}
  />
{/if}

<style>
  .community-page {
    padding: 24px;
    max-width: 1400px;
    margin: 0 auto;
    height: calc(100vh - 52px);
    overflow: hidden;
    display: flex;
    gap: 24px;
  }

  .community-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .community-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 24px;
    align-items: start;
    overflow-y: auto;
    padding-right: 8px;
  }

  .friends-sidebar {
    width: 280px;
    background: #111116;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
  }

  .friends-header {
    padding: 16px;
    font-size: 12px;
    font-weight: 600;
    color: #8e9297;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #2a2b2f;
  }

  .user-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid #2a2b2f;
  }

  .user-card-avatar {
    position: relative;
    width: 40px;
    height: 40px;
    border-radius: 50% 50% 15% 50%;
    background: #2a2b2f;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 700;
    color: #0099ff;
    overflow: hidden;
    flex-shrink: 0;
  }

  .user-card-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .user-card-status {
    position: absolute;
    bottom: 2px;
    right: 0px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2.5px solid #111116;
  }

  .user-card-status.online { background: #00ff88; }
  .user-card-status.away { background: #ffd700; }
  .user-card-status.dnd { background: #ff454a; }
  .user-card-status.offline { background: #5a5a6a; }

  .user-card-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .user-card-name {
    font-size: 14px;
    font-weight: 600;
    color: #e4e6eb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-card-email {
    font-size: 11px;
    color: #8e9297;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .friends-divider {
    padding: 12px 16px 8px;
    font-size: 11px;
    font-weight: 600;
    color: #8e9297;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .friends-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .friend-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .friend-card:hover {
    border-color: #0099ff;
  }

  .friend-avatar {
    position: relative;
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
    overflow: hidden;
    flex-shrink: 0;
  }

  .friend-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .friend-status {
    position: absolute;
    bottom: 4%;
    right: 4%;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid #1a1a1f;
  }

  .friend-status.online { background: #00ff88; }
  .friend-status.away { background: #ffd700; }
  .friend-status.dnd { background: #ff454a; }
  .friend-status.offline { background: #5a5a6a; }

  .friend-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .friend-name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .friend-activity {
    font-size: 11px;
    color: #8e9297;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .community-header{
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }

  .community-header h2 {
    font-size: 20px;
    font-weight: 600;
    color: #e4e6eb;
  }

  .btn-create {
    padding: 6px 16px;
    background: #0099ff;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-create:hover {
    background: #0080e0;
  }

  .community-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 24px;
    align-items: start;
  }

  .card-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .community-card {
    aspect-ratio: 4 / 5;
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 16px;
    overflow: hidden;
    position: relative;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
  }

  .community-card:hover {
    border-color: #0099ff;
    transform: translateY(-4px);
  }

  .card-tab {
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-top: none;
    border-radius: 0 0 8px 8px;
    padding: 6px 12px;
    margin-top: -1px;
    min-width: 80%;
    max-width: 100%;
    text-align: center;
    z-index: 0;
  }

  .card-wrapper:hover .card-tab {
    border-color: #0099ff;
  }

  .tab-text {
    font-size: 12px;
    font-weight: 600;
    color: #e4e6eb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }

  .card-image {
    width: 100%;
    height: 100%;
  }

  .server-image,
  .server-placeholder {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    font-weight: 700;
    color: #0099ff;
  }

  .server-placeholder {
    background: #22222a;
    border-radius: 0 0 0 0;
  }

  .card-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    padding: 8px;
    pointer-events: none;
    z-index: 2;
  }

  .card-members {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 4px;
    padding: 8px;
    z-index: 1;
  }

  .member-avatar {
    width: calc(20% - 4px);
    aspect-ratio: 1;
    max-width: 32px;
    border-radius: 50% 50% 15% 50%;
    background: #2a2b2f;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: #0099ff;
  }

  .member-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .member-avatar.member-more {
    background: #3a3b3f;
    color: #8e9297;
    font-size: 14px;
  }

  .overlay-btn {
    pointer-events: auto;
    width: 56px;
    height: 56px;
    border-radius: 50% 50% 15% 50%;
    border: none;
    background: #0099ff;
    color: white;
    font-size: 20px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .overlay-btn:hover {
    background: #0080e0;
  }

  .overlay-btn.delete-btn {
    width: 28px;
    height: 28px;
    font-size: 12px;
    background: #ff454a;
    border-radius: 50% 50% 15% 50%;
  }
  .overlay-btn.delete-btn:hover {
    background: #cc3338;
  }

  .placeholder-card {
    border: 2px dashed #2a2b2f;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
  }

  .placeholder-card:hover {
    border-color: #0099ff;
    background: #0f0f12;
  }

  .placeholder-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: #8e9297;
  }

  .placeholder-icon {
    font-size: 32px;
    color: #0099ff;
  }

  .placeholder-text {
    font-size: 13px;
    font-weight: 500;
  }

  .error-banner {
    background: #ff453a20;
    border: 1px solid #ff453a40;
    color: #ff6b6b;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    margin-bottom: 16px;
  }
</style>
