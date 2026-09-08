<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from './lib/api';
  import { user } from './lib/stores';

  const { channelId, onSend } = $props();

  let content = $state('');
  let selectedFile: File | null = $state(null);
  let uploading = $state(false);
  let currentUser: any = $state(null);

  user.subscribe((u) => (currentUser = u));

  async function handleSend() {
    if (!content.trim() && !selectedFile) return;

    if (selectedFile) {
      uploading = true;
      try {
        const res = await api.uploadFile(channelId, selectedFile);
        const newMsg = {
          id: res.id || crypto.randomUUID(),
          channelId,
          authorId: currentUser?.id,
          content: content || `[arquivo: ${selectedFile.name}]`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        onSend(newMsg);
        content = '';
        selectedFile = null;
      } catch (e) {
        console.error('Upload failed', e);
      } finally {
        uploading = false;
      }
      return;
    }

    if (!content.trim()) return;

    try {
      const msg = await api.createMessage(channelId, content);
      console.log('Message sent:', msg);
      onSend(msg);
      content = '';
    } catch (e) {
      console.error('Failed to send message', e);
    }
  }

  function handleKeyPress(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !uploading) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      selectedFile = input.files[0];
    }
  }
</script>

<div class="message-input">
  {#if selectedFile}
    <div class="file-preview">
      <span class="file-name">{selectedFile.name}</span>
      <button class="remove-file" onclick={() => (selectedFile = null)}>✕</button>
    </div>
  {/if}

  <div class="input-container">
    <textarea
      bind:value={content}
        onkeydown={handleKeyPress}
      placeholder="Digite uma mensagem..."
      class="text-input"
      rows="1"
      maxlength="4096"
    ></textarea>

    <div class="input-actions">
      <label class="icon-btn" title="Anexar arquivo">
        <input type="file" class="hidden-input" onchange={handleFileSelect} />
        📎
      </label>

      <button
        class="send-btn"
        class:sending={uploading}
        class:disabled={!content.trim() && !selectedFile}
        onclick={handleSend}
        disabled={(!content.trim() && !selectedFile) || uploading}
        title="Enviar"
      >
        {#if uploading}
          ↻
        {:else}
          ➤
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .message-input {
    padding: 12px 16px;
    border-top: 1px solid #2a2b2f;
    background: #111116;
  }

  .file-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 6px;
    margin-bottom: 8px;
    font-size: 12px;
  }

  .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #e4e6eb;
  }

  .remove-file {
    background: none;
    border: none;
    color: #8e9297;
    cursor: pointer;
    padding: 2px 6px;
    font-size: 12px;
  }

  .input-container {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .text-input {
    flex: 1;
    background: #0f0f12;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    color: #e4e6eb;
    font-size: 14px;
    resize: none;
    outline: none;
    padding: 8px 12px;
    min-height: 36px;
    max-height: 120px;
  }

  .text-input:focus {
    border-color: #0099ff;
  }

  .input-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: #8e9297;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-btn:hover {
    background: #22222a;
    color: #e4e6eb;
  }

  .hidden-input {
    display: none;
  }

  .send-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: #0099ff;
    color: white;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .send-btn:hover:not(:disabled) {
    background: #0080e0;
  }

  .send-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .send-btn.disabled {
    opacity: 0.5;
  }

  .send-btn.sending {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
