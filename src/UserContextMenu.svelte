<script lang="ts">
  import { get } from 'svelte/store';
  import { user, currentServer } from './lib/stores';
  import { getUploadUrl, getAvatarDisplayUrl } from './lib/api';
  import type { Server } from './lib/types';

  const { targetUser, x, y, onClose, onMessage } = $props<{
    targetUser: { id: string; username: string; avatarUrl?: string };
    x: number;
    y: number;
    onClose: () => void;
    onMessage?: (userId: string) => void;
  }>();

  const currentUser = $derived(get(user));
  const server = $derived(get(currentServer));
  const isSelf = $derived(currentUser?.id === targetUser.id);

  let menuEl = $state<HTMLDivElement>();

  function handleCopyId() {
    navigator.clipboard.writeText(targetUser.id);
    onClose();
  }

  function handleMessage() {
    onMessage?.(targetUser.id);
    onClose();
  }

  function handleInviteLink() {
    if (server) {
      const link = `${window.location.origin}?invite=${(server as Server).inviteCode}`;
      navigator.clipboard.writeText(link);
      onClose();
    }
  }

  $effect(() => {
    if (menuEl) {
      const rect = menuEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let finalX = x;
      let finalY = y;
      if (x + rect.width > vw) finalX = vw - rect.width - 8;
      if (y + rect.height > vh) finalY = vh - rect.height - 8;
      menuEl.style.left = `${finalX}px`;
      menuEl.style.top = `${finalY}px`;
    }
  });

  $effect(() => {
    const handleClick = () => onClose();
    const handleContext = (e: MouseEvent) => { e.preventDefault(); onClose(); };
    document.addEventListener('click', handleClick);
    document.addEventListener('contextmenu', handleContext);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('contextmenu', handleContext);
    };
  });
</script>

<div class="user-context-backdrop">
  <div class="user-context-menu" bind:this={menuEl} onclick={(e) => e.stopPropagation()}>
    <div class="user-context-header">
      <div class="user-context-avatar">
        {#if targetUser.avatarUrl}
          <img src={getAvatarDisplayUrl(targetUser.avatarUrl)} alt={targetUser.username} />
        {:else}
          <div class="avatar-letter">{targetUser.username?.[0]?.toUpperCase() || '?'}</div>
        {/if}
      </div>
      <div class="user-context-info">
        <span class="user-context-name">{targetUser.username}</span>
        <span class="user-context-id">{targetUser.id.slice(0, 8)}...</span>
      </div>
    </div>
    <div class="user-context-divider"></div>
    {#if !isSelf}
      <button class="user-context-item" onclick={handleMessage}>
        <span class="item-icon">💬</span>
        <span>Enviar mensagem</span>
      </button>
      {#if server}
        <button class="user-context-item" onclick={handleInviteLink}>
          <span class="item-icon">🔗</span>
          <span>Copiar link de convite</span>
        </button>
      {/if}
    {/if}
    <button class="user-context-item" onclick={handleCopyId}>
      <span class="item-icon">📋</span>
      <span>Copiar ID</span>
    </button>
  </div>
</div>

<style>
  .user-context-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2000;
  }

  .user-context-menu {
    position: fixed;
    background: #2a2b2f;
    border: 1px solid #3a3b3f;
    border-radius: 10px;
    padding: 6px;
    min-width: 200px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
    z-index: 2001;
  }

  .user-context-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
  }

  .user-context-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50% 50% 15% 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .user-context-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50% 50% 15% 50%;
  }

  .avatar-letter {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0099ff;
    color: white;
    font-size: 16px;
    font-weight: 700;
    border-radius: 50% 50% 15% 50%;
  }

  .user-context-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .user-context-name {
    font-size: 14px;
    font-weight: 600;
    color: #e4e6eb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-context-id {
    font-size: 11px;
    color: #8e9297;
  }

  .user-context-divider {
    height: 1px;
    background: #3a3b3f;
    margin: 4px 0;
  }

  .user-context-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    background: transparent;
    color: #e4e6eb;
    font-size: 13px;
    cursor: pointer;
    border-radius: 6px;
    text-align: left;
  }

  .user-context-item:hover {
    background: #3a3b3f;
  }

  .item-icon {
    font-size: 16px;
    width: 20px;
    text-align: center;
  }
</style>
