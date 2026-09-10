<script lang="ts">
  import type { Server, Channel, Category } from './lib/types';
  import ChannelItem from './ChannelItem.svelte';

  const {
    server,
    categories = [],
    channels = [],
    selectedChannel,
    activeVoiceChannel = null,
    onSelect,
    onCreateChannel,
    voiceUsers = new Map(),
    onJoinVoice,
    onReorder,
    onEditChannel,
    onDeleteChannel,
  } = $props();

  let showCreate = $state(false);
  let newChannelName = $state('');
  let newChannelType = $state('text');
  let draggedChannelId = $state<string | null>(null);
  let dragOverChannelId = $state<string | null>(null);
  let dragOverPosition = $state<'before' | 'after' | null>(null);

  function handleCreate() {
    if (newChannelName.trim()) {
      onCreateChannel({ name: newChannelName, type: newChannelType as 'text' | 'voice' });
      showCreate = false;
      newChannelName = '';
    }
  }

  function handleDragStart(channelId: string) {
    draggedChannelId = channelId;
  }

  function handleDragOver(channelId: string, position: 'before' | 'after') {
    if (draggedChannelId === channelId) {
      dragOverChannelId = null;
      dragOverPosition = null;
      return;
    }
    dragOverChannelId = channelId;
    dragOverPosition = position;
  }

  function handleDragLeave(channelId: string) {
    if (dragOverChannelId === channelId) {
      dragOverChannelId = null;
      dragOverPosition = null;
    }
  }

  function handleDrop(targetChannelId: string) {
    if (!draggedChannelId || draggedChannelId === targetChannelId) {
      handleDragEnd();
      return;
    }

    const fromIndex = channels.findIndex((c) => c.id === draggedChannelId);
    const toIndex = channels.findIndex((c) => c.id === targetChannelId);

    if (fromIndex === -1 || toIndex === -1) {
      handleDragEnd();
      return;
    }

    const newChannels = [...channels];
    const [moved] = newChannels.splice(fromIndex, 1);

    // Target channel category adoption
    const targetChannel = channels[toIndex];
    if (targetChannel) {
      moved.categoryId = targetChannel.categoryId;
    }

    let insertIndex = newChannels.findIndex((c) => c.id === targetChannelId);
    if (dragOverPosition === 'after') {
      insertIndex += 1;
    }

    newChannels.splice(insertIndex, 0, moved);

    // Update positions
    newChannels.forEach((ch, idx) => {
      ch.position = idx;
    });

    handleDragEnd();
    onReorder?.(newChannels);
  }

  function handleDragEnd() {
    draggedChannelId = null;
    dragOverChannelId = null;
    dragOverPosition = null;
  }
</script>

<div class="channel-sidebar">
  <div class="channels-header">
    <span class="channels-title">Conversas</span>
    <button class="add-channel-btn" onclick={() => showCreate = true} title="Criar canal">+</button>
  </div>
  <div class="channel-list">
    {#if channels.filter(c => !c.categoryId).length > 0}
      <div class="uncategorized-channels">
        {#each channels.filter(c => !c.categoryId) as channel (channel.id)}
          <ChannelItem
            {channel}
            {selectedChannel}
            {activeVoiceChannel}
            {onSelect}
            {voiceUsers}
            {onJoinVoice}
            {onEditChannel}
            {onDeleteChannel}
            isDragging={draggedChannelId === channel.id}
            isDragOver={dragOverChannelId === channel.id}
            {dragOverPosition}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        {/each}
      </div>
    {/if}

    {#each categories as category (category.id)}
      <div class="category-section">
        <div class="category-header">
          <span class="category-name">{category.name.toUpperCase()}</span>
        </div>
        <div class="category-channels">
          {#each channels.filter(c => c.categoryId === category.id) as channel (channel.id)}
            <ChannelItem
              {channel}
              {selectedChannel}
              {activeVoiceChannel}
              {onSelect}
              {voiceUsers}
              {onJoinVoice}
              {onEditChannel}
              {onDeleteChannel}
              isDragging={draggedChannelId === channel.id}
              isDragOver={dragOverChannelId === channel.id}
              {dragOverPosition}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          {/each}
        </div>
      </div>
    {/each}
  </div>

  {#if showCreate}
    <div class="modal-backdrop" onclick={() => showCreate = false}>
      <div class="create-modal" onclick={(e) => e.stopPropagation()}>
        <h3>Criar canal</h3>
        <input type="text" placeholder="Nome do canal" bind:value={newChannelName} class="modal-input" />
        <div class="type-selector">
          <label><input type="radio" bind:group={newChannelType} value="text" /> Texto</label>
          <label><input type="radio" bind:group={newChannelType} value="voice" /> Voz</label>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick={() => showCreate = false}>Cancelar</button>
          <button class="btn btn-primary" onclick={handleCreate}>Criar</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .channel-sidebar { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .channels-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 14px 10px; border-bottom: 1px solid #2a2b2f; }
  .channels-title { font-size: 13px; font-weight: 600; color: #8e9297; text-transform: uppercase; letter-spacing: 0.3px; }
  .add-channel-btn { width: 26px; height: 26px; border-radius: 6px; border: none; background: transparent; color: #8e9297; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
  .add-channel-btn:hover { background: #22222a; color: #e4e6eb; }
  .channel-list { flex: 1; overflow-y: auto; padding-bottom: 16px; }
  .category-section { margin-top: 16px; }
  .category-header { padding: 8px 16px 4px; font-size: 11px; color: #8e9297; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
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
</style>
