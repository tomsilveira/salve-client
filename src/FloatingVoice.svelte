<script lang="ts">
  import { getUploadUrl } from './lib/api';
  import { globalVoiceUsers, activeVoiceChannel, voiceLeaveFn, currentServer, viewMode, currentChannel } from './lib/stores';

  const voiceUsers = $derived($globalVoiceUsers);
  const channel = $derived($activeVoiceChannel);
  const channelUsers = $derived(channel ? (voiceUsers.get(channel.id) || []) : []);
  const server = $derived($currentServer);

  function goToServer() {
    if (server) {
      currentServer.set(server);
      viewMode.set('server');
      if (channel) {
        currentChannel.set(channel);
      }
    }
  }

  function leaveVoice() {
    if ($voiceLeaveFn) {
      $voiceLeaveFn();
    }
    activeVoiceChannel.set(null);
    voiceLeaveFn.set(null);
  }

  let collapsed = $state(false);
</script>

{#if channel && channelUsers.length > 0}
  <div class="floating-voice" class:collapsed>
    <button class="floating-toggle" onclick={() => collapsed = !collapsed} title={collapsed ? "Expandir" : "Recolher"}>
      {collapsed ? '▲' : '▼'}
    </button>

    {#if !collapsed}
      <div class="floating-content">
        <div class="floating-header">
          <div class="channel-info">
            <span class="voice-icon">🔊</span>
            <span class="channel-name">{channel.name}</span>
          </div>
          <span class="user-count">{channelUsers.length}</span>
        </div>

        <div class="user-list">
          {#each channelUsers as u (u.id)}
            <div class="user-item">
              <div class="user-avatar">
                {#if u.avatarUrl}
                  <img src={getUploadUrl(u.avatarUrl)} alt={u.username} class="avatar-img" />
                {:else}
                  <div class="avatar-placeholder">
                    {u.username?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                {/if}
                <div class="status-dot {u.status || 'online'}"></div>
              </div>
              <span class="user-name">{u.username}</span>
            </div>
          {/each}
        </div>

        <div class="floating-actions">
          <button class="action-btn back-btn" onclick={goToServer} title="Voltar ao servidor">
            ← Servidor
          </button>
          <button class="action-btn leave-btn" onclick={leaveVoice} title="Sair da voz">
            ✕ Sair
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .floating-voice {
    position: fixed;
    bottom: 16px;
    right: 16px;
    width: 280px;
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 90;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .floating-voice.collapsed {
    width: auto;
    border-radius: 20px;
  }

  .floating-toggle {
    position: absolute;
    top: 0;
    right: 0;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: #8e9297;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    z-index: 1;
    transition: color 0.2s;
  }

  .floating-toggle:hover {
    color: #e4e6eb;
  }

  .floating-content {
    padding: 12px;
    padding-top: 8px;
  }

  .floating-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    padding-right: 24px;
  }

  .channel-info {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .voice-icon {
    font-size: 14px;
  }

  .channel-name {
    font-size: 13px;
    font-weight: 600;
    color: #e4e6eb;
  }

  .user-count {
    font-size: 11px;
    color: #8e9297;
    background: #2a2b2f;
    padding: 2px 6px;
    border-radius: 8px;
  }

  .user-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 10px;
  }

  .user-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border-radius: 6px;
    transition: background 0.15s;
  }

  .user-item:hover {
    background: #2a2b2f;
  }

  .user-avatar {
    position: relative;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
  }

  .avatar-img {
    width: 28px;
    height: 28px;
    border-radius: 50% 50% 15% 50%;
    object-fit: cover;
  }

  .avatar-placeholder {
    width: 28px;
    height: 28px;
    border-radius: 50% 50% 15% 50%;
    background: #0099ff;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
  }

  .status-dot {
    position: absolute;
    bottom: 4%;
    right: 4%;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid #1a1a1f;
    background: #747f8d;
  }

  .status-dot.online { background: #00ff88; }
  .status-dot.away { background: #faa81a; }
  .status-dot.dnd { background: #ff453a; }

  .user-name {
    font-size: 13px;
    color: #b5bac1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .floating-actions {
    display: flex;
    gap: 6px;
  }

  .action-btn {
    flex: 1;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
  }

  .back-btn {
    background: #2a2b2f;
    color: #e4e6eb;
  }

  .back-btn:hover {
    background: #3a3b3f;
  }

  .leave-btn {
    background: #ff453a20;
    color: #ff6b6b;
  }

  .leave-btn:hover {
    background: #ff453a40;
  }
</style>
