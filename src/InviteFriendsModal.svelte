<script lang="ts">
  import { get } from 'svelte/store';
import { friends, user } from './lib/stores';
import type { Friend } from './lib/types';
import { getUploadUrl } from './lib/api';

  const { server, onClose } = $props<{ server: any; onClose: () => void }>();

  const friendList: Friend[] = $derived(get(friends));
  const inviteLink = $state(`${window.location.origin}?invite=${server.inviteCode}`);
  let copied = $state(false);
  let sendingTo: string | null = $state(null);

  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function shareToFriend(friend: Friend) {
    sendingTo = friend.id;
    const text = `Olá ${friend.username}! Entre na comunidade ${server.name} no Salve: ${inviteLink}`;
    navigator.clipboard.writeText(text);
    setTimeout(() => (sendingTo = null), 2000);
  }
</script>

<div class="modal-backdrop" onclick={onClose}>
  <div class="invite-friends-modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h3>Convidar amigos para {server.name}</h3>
      <button class="close-btn" onclick={onClose}>✕</button>
    </div>

    <div class="invite-link-section">
      <label>Link de convite</label>
      <div class="invite-link-row">
        <input type="text" value={inviteLink} readonly class="invite-link-input" />
        <button class="copy-btn" onclick={copyLink}>
          {#if copied}✓ Copiado{:else}📋 Copiar{/if}
        </button>
      </div>
    </div>

    <div class="friends-section">
      <label>Seus amigos</label>
      {#if friendList.length > 0}
        <div class="friends-list">
          {#each friendList as friend (friend.id)}
            <div class="friend-item">
              <div class="friend-avatar">
                {#if friend.avatarUrl}
                  <img src={getUploadUrl(friend.avatarUrl)} alt={friend.username} />
                {:else}
                  <span>{friend.username?.[0]?.toUpperCase() || '?'}</span>
                {/if}
                <div class="friend-status-dot" class:online={friend.status === 'online'} class:away={friend.status === 'away'} class:dnd={friend.status === 'do-not-disturb'} class:offline={friend.status === 'invisible' || friend.status === 'offline'}></div>
              </div>
              <div class="friend-info">
                <span class="friend-name">{friend.username}</span>
                <span class="friend-status">{friend.status === 'away' ? 'Ausente' : friend.status === 'do-not-disturb' ? 'Ocupado' : friend.status === 'invisible' ? 'Invisível' : 'Online'}</span>
              </div>
              <button class="share-btn" onclick={() => shareToFriend(friend)}>
                {#if sendingTo === friend.id}✓{:else}📤{/if}
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <p class="no-friends">Você ainda não tem amigos. Adicione amigos para convidá-los.</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .invite-friends-modal {
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    padding: 24px;
    width: 450px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .modal-header h3 {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    color: #8e9297;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: #2a2b2f;
    color: #e4e6eb;
  }

  .invite-link-section {
    margin-bottom: 20px;
  }

  .invite-link-section label,
  .friends-section label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #8e9297;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .invite-link-row {
    display: flex;
    gap: 8px;
  }

  .invite-link-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #2a2b2f;
    border-radius: 6px;
    background: #0f0f12;
    color: #e4e6eb;
    font-size: 13px;
    outline: none;
  }

  .copy-btn {
    padding: 8px 16px;
    background: #0099ff;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    white-space: nowrap;
  }

  .copy-btn:hover {
    background: #0080e0;
  }

  .friends-section {
    flex: 1;
    overflow-y: auto;
  }

  .friends-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .friend-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: #0f0f12;
    border: 1px solid #2a2b2f;
    border-radius: 8px;
  }

  .friend-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50% 50% 15% 50%;
    background: #2a2b2f;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    color: #0099ff;
    position: relative;
    flex-shrink: 0;
  }

  .friend-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .friend-status-dot {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid #0f0f12;
    background: #5a5a6a;
  }

  .friend-status-dot.online { background: #00ff88; }
  .friend-status-dot.away { background: #ffd700; }
  .friend-status-dot.dnd { background: #ff454a; }
  .friend-status-dot.offline { background: #5a5a6a; }

  .friend-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .friend-name {
    font-size: 14px;
    font-weight: 500;
  }

  .friend-status {
    font-size: 11px;
    color: #8e9297;
  }

  .share-btn {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 6px;
    background: #2a2b2f;
    color: #e4e6eb;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .share-btn:hover {
    background: #0099ff;
  }

  .no-friends {
    font-size: 13px;
    color: #8e9297;
    text-align: center;
    padding: 20px;
  }
</style>
