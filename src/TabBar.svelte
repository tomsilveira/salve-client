<script lang="ts">
  import { activeTab, viewMode, currentServer, hasUnread } from './lib/stores';

  const { tabs = [
    { id: 'communities', label: 'COMUNIDADES', icon: '💬' },
    { id: 'lives', label: 'LIVES', icon: '📺' },
    { id: 'friends', label: 'AMIGOS', icon: '👥' },
    { id: 'room', label: 'ROOM', icon: '🏠' },
    { id: 'settings', label: 'CONFIGURAÇÕES', icon: '⚙' },
  ], currentServer: server = null } = $props();

  function handleTabClick(tabId: string) {
    if (tabId === 'communities') {
      if (server) {
        viewMode.set('server');
      } else {
        activeTab.set('communities');
      }
      return;
    }
    if ($viewMode === 'server') {
      viewMode.set('tabs');
    }
    activeTab.set(tabId);
  }
</script>

<div class="tab-bar">
  <div class="tab-container">
    {#each tabs as tab (tab.id)}
      {@const isActive = tab.id === 'communities' ? ($viewMode === 'server' || $activeTab === 'communities') : $activeTab === tab.id}
      <div
        class="tab-item"
        class:active={isActive}
        onclick={() => handleTabClick(tab.id)}
      >
        <span class="tab-icon">{tab.icon}</span>
        <span class="tab-label">{tab.id === 'communities' && server ? server.name : tab.label}</span>
        {#if tab.id === 'friends' && $hasUnread && !isActive}
          <div class="tab-badge"></div>
        {/if}
        {#if isActive}
          <div class="tab-indicator"></div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .tab-bar {
    background: #111116;
    border-bottom: 2px solid #2a2b2f;
    position: sticky;
    top: 0;
    z-index: 10;
    flex-shrink: 0;
  }

  .tab-container {
    display: flex;
    gap: 4px;
    padding: 0 24px;
  }

  .tab-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 12px 16px;
    border-radius: 8px 8px 0 0;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #8e9297;
    border: 1px solid transparent;
    border-bottom: none;
    white-space: nowrap;
  }

  .tab-item:hover {
    color: #e4e6eb;
    background: #1a1a1f;
  }

  .tab-item.active {
    color: #0099ff;
    background: #0f0f12;
    border-color: #0099ff;
    border-bottom: none;
    margin-bottom: -1px;
  }

  .tab-icon {
    font-size: 16px;
  }

  .tab-label {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-indicator {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 24px;
    height: 3px;
    background: #0099ff;
    border-radius: 2px;
  }

  .tab-badge {
    width: 8px;
    height: 8px;
    background: #0099ff;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
