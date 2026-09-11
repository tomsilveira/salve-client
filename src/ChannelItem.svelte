<script lang="ts">
  import type { Channel } from './lib/types';
import { getAvatarDisplayUrl } from './lib/api';
import UserContextMenu from './UserContextMenu.svelte';

  const {
    channel,
    selectedChannel = null,
    activeVoiceChannel = null,
    voiceUsers = new Map(),
    isDragging = false,
    isDragOver = false,
    dragOverPosition = null,
    onSelect,
    onJoinVoice,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
    onEditChannel,
    onDeleteChannel,
  } = $props();

  const isSelected = $derived(selectedChannel?.id === channel.id);
  const isActiveVoice = $derived(channel.type === 'voice' && activeVoiceChannel?.id === channel.id);
  const usersInChannel = $derived(voiceUsers.get(channel.id) || []);
  const icon = $derived(channel.type === 'voice' ? '🔊' : '#');

  let contextMenu = $state<{ x: number; y: number } | null>(null);
  let editingName = $state(false);
  let editName = $state('');
  let editTopic = $state(channel.topic || '');
  let userContextMenu = $state<{ user: any; x: number; y: number } | null>(null);

  function handleDragStart(e: DragEvent) {
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', channel.id);
    }
    onDragStart?.(channel.id);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? 'before' : 'after';
    onDragOver?.(channel.id, pos);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    onDrop?.(channel.id);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { x: e.clientX, y: e.clientY };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function startEditName() {
    editName = channel.name;
    editingName = true;
    contextMenu = null;
  }

  function saveEditName() {
    if (editName.trim() && editName !== channel.name) {
      onEditChannel?.(channel.id, { name: editName.trim() });
    }
    editingName = false;
  }

  function handleDeleteChannel() {
    contextMenu = null;
    onDeleteChannel?.(channel.id);
  }

  function handleUserContextMenu(e: MouseEvent, user: any) {
    e.preventDefault();
    e.stopPropagation();
    userContextMenu = { user, x: e.clientX, y: e.clientY };
  }

  $effect(() => {
    if (contextMenu) {
      const handler = () => closeContextMenu();
      document.addEventListener('click', handler);
      document.addEventListener('contextmenu', handler);
      return () => {
        document.removeEventListener('click', handler);
        document.removeEventListener('contextmenu', handler);
      };
    }
  });
</script>

<div
  class="channel-wrapper"
  class:dragging={isDragging}
  class:drag-over-before={isDragOver && dragOverPosition === 'before'}
  class:drag-over-after={isDragOver && dragOverPosition === 'after'}
>
  <div
    class="channel-item"
    class:selected={isSelected || isActiveVoice}
    class:is-voice={channel.type === 'voice'}
    draggable={true}
    ondragstart={handleDragStart}
    ondragover={handleDragOver}
    ondragleave={() => onDragLeave?.(channel.id)}
    ondrop={handleDrop}
    ondragend={() => onDragEnd?.()}
    onclick={() => onSelect(channel)}
    oncontextmenu={handleContextMenu}
    title="{channel.name} — Arraste para reordenar"
  >
    <span class="drag-handle" title="Arrastar">⠿</span>
    <span class="channel-icon">{icon}</span>
    {#if editingName}
      <input
        type="text"
        class="channel-name-input"
        bind:value={editName}
        onblur={saveEditName}
        onkeydown={(e) => { if (e.key === 'Enter') saveEditName(); if (e.key === 'Escape') editingName = false; }}
        onclick={(e) => e.stopPropagation()}
        autofocus
      />
    {:else}
      <span class="channel-name">{channel.name}</span>
    {/if}

    {#if channel.type === 'voice'}
      {#if usersInChannel.length > 0}
        <div class="channel-voice-count" title="{usersInChannel.length} conectado(s)">
          {usersInChannel.length}
        </div>
      {/if}
      <button
        class="voice-join-btn"
        class:active-call={isActiveVoice}
        title={isActiveVoice ? 'Conectado à sala de voz' : 'Conectar à sala de voz'}
        onclick={(e) => {
          e.stopPropagation();
          onJoinVoice(channel);
        }}
      >
        {isActiveVoice ? '🟢' : '⎆'}
      </button>
    {/if}
  </div>

  <!-- Connected voice users expanded list under the channel (Discord style) -->
  {#if channel.type === 'voice' && usersInChannel.length > 0}
    <div class="channel-members-list">
      {#each usersInChannel as user (user.id)}
        <div class="channel-member-item" onclick={() => onSelect(channel)} title="{user.username} ({user.status || 'online'})" style={user.accentColor ? `background: linear-gradient(to right, ${user.accentColor}20, transparent)` : ''}>
          <div class="member-avatar" oncontextmenu={(e) => handleUserContextMenu(e, user)}>
            {#if user.avatarUrl}
              <img src={getAvatarDisplayUrl(user.avatarUrl)} alt={user.username} />
            {:else}
              <span>{user.username?.[0]?.toUpperCase() || '?'}</span>
            {/if}
            <div
              class="member-status-dot"
              class:online={user.status === 'online' || !user.status}
              class:away={user.status === 'away'}
              class:dnd={user.status === 'do-not-disturb'}
              class:offline={user.status === 'invisible' || user.status === 'offline'}
            ></div>
          </div>
          <span class="member-username">{user.username}</span>
          <span class="speaking-indicator">🎙</span>
        </div>
      {/each}
    </div>
  {/if}

  {#if contextMenu}
    <div class="context-menu-backdrop" onclick={closeContextMenu} oncontextmenu={(e) => { e.preventDefault(); closeContextMenu(); }}>
      <div class="context-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;" onclick={(e) => e.stopPropagation()}>
        <button class="context-menu-item" onclick={startEditName}>✏️ Renomear</button>
        <button class="context-menu-item danger" onclick={handleDeleteChannel}>🗑️ Excluir</button>
      </div>
    </div>
  {/if}

  {#if userContextMenu}
    <UserContextMenu
      targetUser={userContextMenu.user}
      x={userContextMenu.x}
      y={userContextMenu.y}
      onClose={() => userContextMenu = null}
    />
  {/if}
</div>

<style>
  .channel-wrapper {
    position: relative;
    margin: 1px 8px;
    border-radius: 6px;
    transition: background 0.15s;
  }

  .channel-wrapper.drag-over-before::before {
    content: '';
    position: absolute;
    top: -2px;
    left: 4px;
    right: 4px;
    height: 2px;
    background: #0099ff;
    border-radius: 2px;
    z-index: 10;
  }

  .channel-wrapper.drag-over-after::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 4px;
    right: 4px;
    height: 2px;
    background: #0099ff;
    border-radius: 2px;
    z-index: 10;
  }

  .channel-wrapper.dragging {
    opacity: 0.35;
  }

  .channel-item {
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    color: #8e9297;
    font-size: 13.5px;
    transition: all 0.15s ease;
    user-select: none;
  }

  .channel-item:hover {
    background: #22222a;
    color: #e4e6eb;
  }

  .channel-item:hover .drag-handle {
    opacity: 0.8;
  }

  .channel-item:hover .voice-join-btn {
    opacity: 1;
  }

  .channel-item.selected {
    background: #0099ff20;
    color: #0099ff;
    font-weight: 500;
  }

  .drag-handle {
    font-size: 11px;
    color: #5a5a6a;
    opacity: 0;
    cursor: grab;
    transition: opacity 0.15s;
    line-height: 1;
    margin-right: -2px;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .channel-icon {
    font-size: 15px;
    width: 18px;
    display: flex;
    justify-content: center;
    flex-shrink: 0;
  }

  .channel-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .channel-voice-count {
    font-size: 10px;
    font-weight: 600;
    color: #00ff88;
    background: #00ff8815;
    padding: 1px 6px;
    border-radius: 10px;
    border: 1px solid #00ff8830;
  }

  .voice-join-btn {
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: #0099ff;
    color: white;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s, background 0.15s;
    flex-shrink: 0;
  }

  .voice-join-btn:hover {
    background: #0080e0;
  }

  .voice-join-btn.active-call {
    opacity: 1;
    background: #00ff8820;
  }

  /* Sub-list of members in voice channel */
  .channel-members-list {
    margin-left: 24px;
    margin-top: 2px;
    margin-bottom: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .channel-member-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    color: #b9bbbe;
    transition: background 0.15s, color 0.15s;
  }

  .channel-member-item:hover {
    background: #1c1d23;
    color: #ffffff;
  }

  .member-avatar {
    width: 18px;
    height: 18px;
    border-radius: 50% 50% 15% 50%;
    background: #2a2b2f;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    color: #0099ff;
    position: relative;
    flex-shrink: 0;
  }

  .member-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50% 50% 15% 50%;
  }

  .member-status-dot {
    position: absolute;
    bottom: 4%;
    right: 4%;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    border: 1px solid #111116;
    background: #5a5a6a;
  }

  .member-status-dot.online { background: #00ff88; }
  .member-status-dot.away { background: #ffd700; }
  .member-status-dot.dnd { background: #ff454a; }
  .member-status-dot.offline { background: #5a5a6a; }

  .member-username {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .speaking-indicator {
    font-size: 10px;
    color: #8e9297;
    opacity: 0.6;
  }

  .channel-name-input {
    flex: 1;
    background: #1a1b1e;
    border: 1px solid #0099ff;
    border-radius: 4px;
    color: #e4e6eb;
    font-size: 14px;
    padding: 2px 6px;
    outline: none;
    min-width: 0;
  }

  .context-menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
  }

  .context-menu {
    position: fixed;
    background: #2a2b2f;
    border: 1px solid #3a3b3f;
    border-radius: 8px;
    padding: 4px;
    min-width: 160px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    z-index: 1001;
  }

  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: #e4e6eb;
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
    text-align: left;
  }

  .context-menu-item:hover {
    background: #3a3b3f;
  }

  .context-menu-item.danger {
    color: #ff454a;
  }

  .context-menu-item.danger:hover {
    background: rgba(255, 69, 74, 0.15);
  }
</style>
