<script lang="ts">
  import { onMount } from 'svelte';
  import { loadAuth, clearAuth, user, activeTab, viewMode, currentServer, activeVoiceChannel, liveStreams } from './lib/stores';
  import { api, API_BASE } from './lib/api';
  import Login from './Login.svelte';
  import MainLayout from './MainLayout.svelte';
  import TabBar from './TabBar.svelte';
  import RoomFeed from './RoomFeed.svelte';
  import FriendsList from './FriendsList.svelte';
  import CommunityGrid from './CommunityGrid.svelte';
  import LiveGrid from './LiveGrid.svelte';
  import LiveViewer from './LiveViewer.svelte';
  import Settings from './Settings.svelte';
  import FloatingVoice from './FloatingVoice.svelte';
  import type { LiveStream } from './lib/types';

  let selectedLive: LiveStream | null = $state(null);

  function handleSelectedLive(live: LiveStream) {
    selectedLive = live;
  }

  $effect(() => {
    if (selectedLive && !$liveStreams.some(s => s.id === selectedLive!.id)) {
      selectedLive = null;
    }
  });

  let showInviteModal = $state(false);
  let inviteServerName = $state('');
  let joining = $state(false);
  let joinError = $state('');
  let inviteCode = $state('');

  onMount(() => {
    loadAuth();
    if ($user) {
      api.getMe().then((me) => {
        user.set({ ...$user!, avatarUrl: me.avatarUrl || '', status: me.status || 'online' });
      }).catch(() => {
        clearAuth();
        window.location.reload();
      });
    }
    const params = new URLSearchParams(window.location.search);
    const code = params.get('invite');
    if (code) {
      inviteCode = code;
      // If user is not logged in, save invite and wait for login
      if (!$user) {
        localStorage.setItem('pending_invite', code);
      } else {
        showInviteModal = true;
        loadServerInfo(code);
      }
    } else {
      // Check for pending invite from localStorage
      const pendingInvite = localStorage.getItem('pending_invite');
      if (pendingInvite) {
        inviteCode = pendingInvite;
        if ($user) {
          showInviteModal = true;
          loadServerInfo(pendingInvite);
        }
      }
    }
  });

  $effect(() => {
    // When user logs in, check for pending invite
    if ($user && inviteCode && !showInviteModal) {
      showInviteModal = true;
      loadServerInfo(inviteCode);
    }
  });

  function loadServerInfo(code: string) {
    fetch(`${API_BASE}/servers/by-invite/${code}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((server) => {
        if (server) inviteServerName = server.name;
      })
      .catch(() => {});
  }

  async function joinServer() {
    joining = true;
    joinError = '';
    try {
      await api.joinServer(inviteCode);
      showInviteModal = false;
      localStorage.removeItem('pending_invite');
      // Refresh and navigate to communities
      window.location.search = '';
      window.location.reload();
    } catch (e: any) {
      joinError = e.message || 'Falha ao entrar no servidor';
    } finally {
      joining = false;
    }
  }

  function declineInvite() {
    showInviteModal = false;
    localStorage.removeItem('pending_invite');
    inviteCode = '';
    window.location.search = '';
  }
</script>

{#if $user}
  <TabBar currentServer={$currentServer} />
  <div class="app-body" class:server-mode={$viewMode === 'server'}>
    <div class="main-layout-wrapper" class:hidden={$viewMode !== 'server'}>
      <MainLayout onBack={() => { viewMode.set('tabs'); currentServer.set(null); activeTab.set('communities'); }} />
    </div>
    {#if $viewMode !== 'server'}
      <div class="tab-content">
        {#if selectedLive}
          <LiveViewer live={selectedLive} onBack={() => selectedLive = null} />
        {:else if $activeTab === 'room'}
          <RoomFeed />
        {:else if $activeTab === 'friends'}
          <FriendsList />
        {:else if $activeTab === 'communities'}
          <CommunityGrid />
        {:else if $activeTab === 'lives'}
          <LiveGrid onSelectLive={(live) => selectedLive = live} />
        {:else if $activeTab === 'settings'}
          <Settings />
        {/if}
      </div>
    {/if}
  </div>
  {#if $activeVoiceChannel && $viewMode === 'tabs'}
    <FloatingVoice />
  {/if}
{:else}
  <Login />
{/if}

{#if showInviteModal}
  <div class="modal-backdrop" onclick={declineInvite}>
    <div class="invite-modal" onclick={(e) => e.stopPropagation()}>
      <h3>Convite para servidor</h3>
      <p class="invite-text">
        Você foi convidado para entrar no servidor <strong>{inviteServerName || inviteCode}</strong>
      </p>
      {#if joinError}
        <div class="error-message">{joinError}</div>
      {/if}
      <div class="invite-actions">
        <button class="btn btn-secondary" onclick={declineInvite}>Recusar</button>
        <button class="btn btn-primary" onclick={joinServer} disabled={joining}>
          {joining ? 'Entrando...' : 'Aceitar convite'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .invite-modal {
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    padding: 24px;
    width: 400px;
    text-align: center;
  }
  .invite-modal h3 {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 16px;
  }
  .invite-text {
    font-size: 14px;
    color: #8e9297;
    margin-bottom: 20px;
  }
  .invite-text strong {
    color: #e4e6eb;
  }
  .error-message {
    background: #ff453a20;
    border: 1px solid #ff453a40;
    color: #ff6b6b;
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 16px;
    font-size: 13px;
  }
  .invite-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  .btn {
    padding: 8px 16px;
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
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .tab-content {
    height: calc(100vh - 52px);
    overflow-y: auto;
    background: #0f0f12;
    color: #e4e6eb;
  }
  .app-body {
    height: calc(100vh - 52px);
    overflow: hidden;
    position: relative;
  }
  .app-body.server-mode {
    overflow: visible;
  }
  .main-layout-wrapper {
    height: 100%;
  }
  .main-layout-wrapper.hidden {
    display: none;
  }
</style>
