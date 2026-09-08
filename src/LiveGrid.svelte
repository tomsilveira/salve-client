<script lang="ts">
  import { liveStreams } from './lib/stores';
  import type { LiveStream } from './lib/types';
  import { getUploadUrl } from './lib/api';

  const { onSelectLive = () => {} } = $props();

  let streams = $derived($liveStreams);

  function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function formatViewers(count: number): string {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  }
</script>

<div class="lives-page">
  <div class="lives-header">
    <h2>Lives</h2>
    <span class="lives-count">{streams.length} lives ao vivo</span>
  </div>

  <div class="lives-grid">
  {#if streams.length === 0}
    <div class="empty-state">
      <span class="empty-icon">📡</span>
      <p>Nenhuma live no momento.</p>
      <p class="empty-hint">Inicie uma transmissão em uma sala de voz para aparecer aqui!</p>
    </div>
  {:else}
      {#each streams as stream (stream.id)}
        <button class="live-card" onclick={() => onSelectLive(stream)}>
          <div class="live-preview">
            <div class="live-thumbnail" style="background-image: url('{stream.thumbnailUrl}')"></div>
            <div class="live-badge">AO VIVO</div>
            <div class="live-viewers">{formatViewers(stream.viewerCount)} espectadores</div>
          </div>

          <div class="live-streamer">
            <div class="streamer-avatar">
              {#if stream.streamer.avatarUrl}
                <img src={getUploadUrl(stream.streamer.avatarUrl)} alt={stream.streamer.username} />
              {:else}
                <div class="avatar-placeholder">{stream.streamer.username?.[0]?.toUpperCase() || '?'}</div>
              {/if}
            </div>
            <div class="streamer-name">{stream.streamer.username}</div>
          </div>

          <div class="live-info">
            <div class="live-title">{stream.title}</div>
            <div class="live-game">{stream.gameName}</div>
            <div class="live-duration">🕒 {formatDuration(stream.durationMinutes)}</div>
          </div>
        </button>
      {/each}
    {/if}
  </div>
</div>

<style>
  .lives-page {
    padding: 24px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .lives-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .lives-header h2 {
    font-size: 20px;
    font-weight: 600;
    color: #e4e6eb;
  }

  .lives-count {
    font-size: 13px;
    color: #8e9297;
  }

  .lives-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
    align-items: start;
  }

  .live-card {
    display: block;
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    aspect-ratio: 4 / 5;
    transition: all 0.2s;
    width: 100%;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }

  .live-card:hover {
    border-color: #0099ff;
    transform: translateY(-4px);
  }

  .live-preview {
    position: relative;
    width: 100%;
    height: 140px;
  }

  .live-thumbnail {
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    border-bottom: 1px solid #2a2b2f;
  }

  .live-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 2px 8px;
    background: #ff454a;
    color: white;
    font-size: 10px;
    font-weight: 700;
    border-radius: 4px;
  }

  .live-viewers {
    position: absolute;
    bottom: 8px;
    right: 8px;
    padding: 2px 8px;
    background: rgba(0, 0, 0, 0.6);
    color: #e4e6eb;
    font-size: 11px;
    border-radius: 4px;
  }

  .live-streamer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px 8px;
  }

  .streamer-avatar {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
  }

  .streamer-avatar img,
  .streamer-avatar .avatar-placeholder {
    width: 100%;
    height: 100%;
    border-radius: 50% 50% 15% 50%;
    object-fit: cover;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .streamer-name {
    font-size: 13px;
    font-weight: 600;
    color: #e4e6eb;
  }

  .live-info {
    padding: 0 16px 12px;
  }

  .live-title {
    font-size: 12px;
    font-weight: 600;
    color: #e4e6eb;
    margin-bottom: 4px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .live-game {
    font-size: 12px;
    color: #8e9297;
    margin-bottom: 4px;
  }

  .live-duration {
    font-size: 11px;
    color: #5a5a6a;
  }

  .empty-state {
    padding: 40px;
    text-align: center;
    color: #8e9297;
    font-size: 13px;
    grid-column: 1 / -1;
  }

  .empty-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 16px;
  }

  .empty-hint {
    font-size: 12px;
    color: #5a5a6a;
    margin-top: 8px;
  }
</style>
