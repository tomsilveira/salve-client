<script lang="ts">
import type { Server, ServerMember } from './lib/types';
import { getUploadUrl } from './lib/api';

const { servers = [], selectedServer = null, currentUser = null, members = [], showBack = false, onback, onselect, oncreate, ontoggleUserPanel } = $props();
</script>

<div class="server-sidebar">
  <div class="server-list">
    {#each servers as server (server.id)}
      <div
        class:selected={selectedServer?.id === server.id}
        class="server-item"
        onclick={() => onselect?.(server)}
        title={server.name}
      >
        {#if server.iconUrl}
          <img src={getUploadUrl(server.iconUrl)} alt={server.name} class="server-icon" />
        {:else}
          {server.name?.[0]?.toUpperCase() || '?'}
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .server-sidebar {
    width: 72px;
    background: #0a0a0e;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 12px;
    padding-bottom: 12px;
    overflow-y: auto;
  }
  .server-list { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .server-item {
    width: 48px; height: 48px; border-radius: 14px; background: #22222a;
    border: 2px solid transparent; display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 600; cursor: pointer; transition: all 0.15s; overflow: hidden;
  }
  .server-item:hover { background: #2a2b2f; transform: scale(1.05); }
  .server-item.selected { background: #0099ff; color: white; border-color: #0099ff; }
  .server-item.add-server { border-radius: 16px; font-size: 28px; color: #8e9297; border-style: dashed; border-width: 2px; border-color: #2a2b2f; }
  .server-item.add-server:hover { color: #0099ff; border-color: #0099ff; }
  .server-icon { width: 48px; height: 48px; object-fit: cover; border-radius: 12px; }
</style>
