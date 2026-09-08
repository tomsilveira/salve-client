<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import type { Channel, Message } from './lib/types';
  import MessageBubble from './MessageBubble.svelte';

  const { messages = [], currentUser, onEdit, onDelete } = $props();

  let container: HTMLDivElement;
  const displayedMessages = $derived(messages ?? []);

  $effect(() => {
    if (container && messages.length) {
      tick().then(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  });
</script>

<div class="message-list" bind:this={container}>
  {#if displayedMessages.length === 0}
    <div class="empty-state">
      <p>Nenhuma mensagem ainda. Seja o primeiro a falar!</p>
    </div>
  {:else}
    <div class="messages-wrapper">
      {#each displayedMessages as msg (msg.id)}
        <MessageBubble {msg} {currentUser} {onEdit} {onDelete} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .message-list {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
  }

  .messages-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .empty-state {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #5a5a6a;
    font-size: 13px;
    padding: 40px;
  }
</style>
