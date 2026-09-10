<script lang="ts">
  import type { Message } from './lib/types';

  const { msg, currentUser, onEdit, onDelete } = $props();

  const isOwn = currentUser?.id === msg.authorId;
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let showMenu = $state(false);
  let dropdownOpen = $state(false);
  let editing = $state(false);
  let editText = $state(msg.content);

  const inviteMatch = $derived(msg.content.match(/\?invite=([A-Za-z0-9-]+)/));
  const inviteCode = $derived(inviteMatch ? inviteMatch[1] : null);

  function handleAcceptInvite(code: string) {
    window.location.href = `/?invite=${code}`;
  }

  function handleEdit() {
    editing = true;
    editText = msg.content;
    showMenu = false;
    dropdownOpen = false;
  }

  function saveEdit() {
    if (editText.trim() && onEdit) {
      onEdit(msg.id, editText.trim());
    }
    editing = false;
  }

  function cancelEdit() {
    editing = false;
    editText = msg.content;
  }

  function handleDelete() {
    if (onDelete) onDelete(msg.id);
    showMenu = false;
    dropdownOpen = false;
  }
</script>

<div class="message-bubble" class:own={isOwn} onmouseenter={() => isOwn && (showMenu = true)} onmouseleave={() => { if (!dropdownOpen) showMenu = false; }}>
  <div class="message-content">
    {#if editing}
      <input type="text" bind:value={editText} class="edit-input" onkeydown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }} autofocus />
      <div class="edit-actions">
        <button class="edit-btn" onclick={saveEdit}>Salvar</button>
        <button class="edit-btn cancel" onclick={cancelEdit}>Cancelar</button>
      </div>
    {:else}
      {#if msg.content}
        <div class="message-text">{msg.content}</div>
      {/if}
      {#if inviteCode}
        <div class="invite-card">
          <div class="invite-icon">🔗</div>
          <div class="invite-info">
            <span class="invite-label">Convite para servidor</span>
            <span class="invite-code">{inviteCode}</span>
          </div>
          <button class="invite-accept-btn" onclick={() => handleAcceptInvite(inviteCode)}>
            Aceitar
          </button>
        </div>
      {/if}
      <div class="message-meta">
        <span class="message-time">{time}</span>
      </div>
    {/if}
  </div>
  {#if showMenu && !editing}
    <button class="menu-trigger" onclick={(e) => { e.stopPropagation(); dropdownOpen = !dropdownOpen; }}>⋯</button>
  {/if}
  {#if showMenu && dropdownOpen && !editing}
    <div class="menu-dropdown">
      <button class="menu-item" onclick={handleCopy}>Copiar</button>
      {#if isOwn}
        <button class="menu-item" onclick={handleEdit}>Editar</button>
        <button class="menu-item delete" onclick={handleDelete}>Apagar</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .message-bubble {
    max-width: 60%;
    margin-bottom: 4px;
    align-self: flex-start;
    position: relative;
  }

  .message-bubble.own {
    align-self: flex-end;
  }

  .message-content {
    padding: 6px 12px;
    border-radius: 12px;
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .message-bubble.own .message-content {
    background: #0099ff;
    border-color: #0099ff;
  }

  .message-text {
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
  }

  .message-meta {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .message-time {
    font-size: 10px;
    color: #8e9297;
  }

  .message-bubble.own .message-time {
    color: #cfe8ff;
  }

  .message-menu {
    position: absolute;
    top: -8px;
    right: 0;
  }

  .message-bubble.own .message-menu {
    right: auto;
    left: -24px;
  }

  .menu-trigger {
    background: #2a2b2f;
    border: none;
    color: #8e9297;
    width: 24px;
    height: 24px;
    border-radius: 50% 50% 15% 50%;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .menu-trigger:hover {
    background: #3a3b3f;
    color: #e4e6eb;
  }

  .menu-dropdown {
    position: absolute;
    top: 28px;
    right: 0;
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 8px;
    overflow: hidden;
    z-index: 10;
    min-width: 120px;
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: 8px 16px;
    background: transparent;
    border: none;
    color: #e4e6eb;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  .menu-item:hover {
    background: #2a2b2f;
  }

  .menu-item.delete {
    color: #ff454a;
  }

  .menu-item.delete:hover {
    background: #ff454a20;
  }

  .edit-input {
    background: transparent;
    border: 1px solid #0099ff40;
    border-radius: 4px;
    padding: 4px 8px;
    color: #e4e6eb;
    font-size: 13px;
    outline: none;
  }

  .edit-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .edit-btn {
    padding: 4px 12px;
    border-radius: 4px;
    border: none;
    background: #0099ff;
    color: white;
    font-size: 12px;
    cursor: pointer;
  }

  .edit-btn.cancel {
    background: transparent;
    color: #8e9297;
  }

  .invite-card {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
    padding: 10px 14px;
    background: rgba(0, 153, 255, 0.1);
    border: 1px solid rgba(0, 153, 255, 0.3);
    border-radius: 8px;
  }

  .invite-icon {
    font-size: 20px;
  }

  .invite-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .invite-label {
    font-size: 12px;
    font-weight: 600;
    color: #e4e6eb;
  }

  .invite-code {
    font-size: 11px;
    color: #8e9297;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .invite-accept-btn {
    padding: 6px 16px;
    border-radius: 6px;
    border: none;
    background: #23a559;
    color: white;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .invite-accept-btn:hover {
    background: #1a8c47;
  }
</style>
