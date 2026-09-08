<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getUploadUrl } from './lib/api';
  import { remoteScreenStreams, user } from './lib/stores';
  import type { LiveStream } from './lib/types';

  const { live, onBack } = $props();

  let videoEl: HTMLVideoElement | null = $state(null);
  let chatInput = $state('');
  let chatMessages: { userId: string; username: string; text: string; time: Date }[] = $state([]);
  let duration = $state(0);
  let durationInterval: ReturnType<typeof setInterval>;

  const screenStreams = $derived($remoteScreenStreams);
  const remoteStream = $derived(screenStreams.get(live.streamer.id));

  $effect(() => {
    if (videoEl && remoteStream) {
      videoEl.srcObject = remoteStream;
    }
  });

  onMount(() => {
    durationInterval = setInterval(() => {
      duration++;
    }, 1000);
  });

  onDestroy(() => {
    clearInterval(durationInterval);
  });

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function sendChat() {
    if (!chatInput.trim() || !$user) return;
    chatMessages = [...chatMessages, {
      userId: $user.id,
      username: $user.username,
      text: chatInput.trim(),
      time: new Date(),
    }];
    chatInput = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  }
</script>

<div class="live-viewer">
  <div class="live-viewer-header">
    <button class="back-btn" onclick={onBack}>← Voltar</button>
    <div class="live-viewer-info">
      <div class="live-badge">AO VIVO</div>
      <span class="live-title">{live.title}</span>
      <span class="live-game">{live.gameName}</span>
      <span class="live-duration">{formatDuration(duration)}</span>
    </div>
  </div>

  <div class="live-viewer-body">
    <div class="live-video-area">
      {#if remoteStream}
        <video bind:this={videoEl} autoplay playsinline class="live-video"></video>
      {:else}
        <div class="video-placeholder">
          <div class="placeholder-avatar">
            {#if live.streamer.avatarUrl}
              <img src={getUploadUrl(live.streamer.avatarUrl)} alt={live.streamer.username} />
            {:else}
              <div class="avatar-letter">{live.streamer.username?.[0]?.toUpperCase() || '?'}</div>
            {/if}
          </div>
          <div class="placeholder-name">{live.streamer.username}</div>
          <div class="placeholder-status">Conectando à live...</div>
          <div class="placeholder-hint">Entre no canal de voz para assistir</div>
        </div>
      {/if}
    </div>

    <div class="live-chat">
      <div class="chat-header">
        <span class="chat-title">Chat da Live</span>
        <span class="chat-viewers">👁 {live.viewerCount || 0}</span>
      </div>

      <div class="chat-messages">
        {#if chatMessages.length === 0}
          <div class="chat-empty">
            <p>Nenhuma mensagem ainda.</p>
            <p class="chat-empty-hint">Seja o primeiro a comentar!</p>
          </div>
        {:else}
          {#each chatMessages as msg, i (i)}
            <div class="chat-message">
              <span class="msg-username">{msg.username}</span>
              <span class="msg-text">{msg.text}</span>
            </div>
          {/each}
        {/if}
      </div>

      <div class="chat-input-area">
        <input
          type="text"
          class="chat-input"
          placeholder="Enviar mensagem..."
          bind:value={chatInput}
          onkeydown={handleKeydown}
        />
        <button class="chat-send" onclick={sendChat}>➤</button>
      </div>
    </div>
  </div>
</div>

<style>
  .live-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0f0f12;
  }

  .live-viewer-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 20px;
    background: #1a1a1f;
    border-bottom: 1px solid #2a2b2f;
  }

  .back-btn {
    background: transparent;
    border: 1px solid #2a2b2f;
    color: #8e9297;
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.15s;
  }

  .back-btn:hover {
    background: #22222a;
    color: #e4e6eb;
    border-color: #3a3b3f;
  }

  .live-viewer-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .live-badge {
    padding: 2px 8px;
    background: #ff454a;
    color: white;
    font-size: 11px;
    font-weight: 700;
    border-radius: 4px;
  }

  .live-title {
    font-size: 14px;
    font-weight: 600;
    color: #e4e6eb;
  }

  .live-game {
    font-size: 13px;
    color: #8e9297;
  }

  .live-duration {
    font-size: 12px;
    color: #5a5a6a;
    font-family: monospace;
  }

  .live-viewer-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .live-video-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    min-height: 0;
  }

  .live-video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .video-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: #8e9297;
  }

  .placeholder-avatar {
    width: 80px;
    height: 80px;
  }

  .placeholder-avatar img,
  .placeholder-avatar .avatar-letter {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #22222a;
    font-size: 32px;
    font-weight: 600;
    color: #e4e6eb;
  }

  .placeholder-name {
    font-size: 18px;
    font-weight: 600;
    color: #e4e6eb;
  }

  .placeholder-status {
    font-size: 13px;
    color: #8e9297;
  }

  .placeholder-hint {
    font-size: 12px;
    color: #5a5a6a;
  }

  .live-chat {
    width: 320px;
    display: flex;
    flex-direction: column;
    background: #1a1a1f;
    border-left: 1px solid #2a2b2f;
  }

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #2a2b2f;
  }

  .chat-title {
    font-size: 13px;
    font-weight: 600;
    color: #e4e6eb;
  }

  .chat-viewers {
    font-size: 12px;
    color: #8e9297;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .chat-empty {
    text-align: center;
    color: #5a5a6a;
    font-size: 13px;
    margin-top: 40px;
  }

  .chat-empty-hint {
    font-size: 12px;
    color: #3a3b3f;
    margin-top: 4px;
  }

  .chat-message {
    font-size: 13px;
    line-height: 1.4;
  }

  .msg-username {
    font-weight: 600;
    color: #0099ff;
    margin-right: 6px;
  }

  .msg-text {
    color: #e4e6eb;
  }

  .chat-input-area {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid #2a2b2f;
  }

  .chat-input {
    flex: 1;
    padding: 8px 12px;
    background: #0f0f12;
    border: 1px solid #2a2b2f;
    border-radius: 6px;
    color: #e4e6eb;
    font-size: 13px;
    outline: none;
  }

  .chat-input:focus {
    border-color: #0099ff;
  }

  .chat-send {
    width: 36px;
    height: 36px;
    background: #0099ff;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .chat-send:hover {
    background: #0088e6;
  }
</style>
