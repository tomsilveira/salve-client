<script lang="ts">
  import { get } from 'svelte/store';
  import { friends, user } from './lib/stores';
  import type { Friend } from './lib/types';
  import { api, getUploadUrl } from './lib/api';

  let friendList: Friend[] = [];
  let showAddModal = false;
  let searchQuery = '';
  let searchResults: any[] = [];
  let showMessageModal = false;
  let selectedFriend: Friend | null = null;
  let messageText = '';
  const conversations: Record<string, any[]> = {};
  let friendRequests: any[] = [];
  let sentRequests: any[] = [];
  let onlineUsers: Record<string, string> = {};
  let isLoading = false;

  friends.subscribe((f) => {
    friendList = f;
    updateOnlineStatus();
  });

  async function loadFriendRequests() {
    isLoading = true;
    try {
      const [received, sent] = await Promise.all([
        api.getFriendRequests(),
        api.getSentFriendRequests(),
      ]);
      friendRequests = received || [];
      sentRequests = sent || [];
      console.log('Loaded friend requests:', { received: received?.length, sent: sent?.length });
    } catch (e) {
      console.error('Failed to load friend requests', e);
      friendRequests = [];
      sentRequests = [];
    } finally {
      isLoading = false;
    }
  }

  async function loadFriendsFromDB() {
    try {
      const dbFriends = await api.getFriends();
      if (dbFriends && dbFriends.length > 0) {
        const mapped: Friend[] = dbFriends.map((u: any) => ({
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl || u.avatar_url || '',
          status: u.status || 'offline',
          activity: '',
        }));
        friends.set(mapped);
      }
    } catch (e) {
      console.error('Failed to load friends from DB', e);
    }
  }

  async function updateOnlineStatus() {
    if (friendList.length === 0) return;
    try {
      const ids = friendList.map((f) => f.id);
      onlineUsers = await api.getOnlineStatus(ids);
    } catch (e) {
      console.error('Failed to get online status', e);
    }
  }

  function startHeartbeat() {
    setInterval(async () => {
      try {
        await api.heartbeat();
        await updateOnlineStatus();
      } catch (e) {
        // Ignore errors - user might not be logged in
      }
    }, 30000);
  }

  // Load data when component mounts
  loadFriendRequests();
  loadFriendsFromDB();
  startHeartbeat();

  function toggleAddModal() {
    showAddModal = !showAddModal;
    if (!showAddModal) {
      searchQuery = '';
      searchResults = [];
    }
  }

  async function searchUsers() {
    if (!searchQuery.trim()) return;
    try {
      const results = await api.searchUsers(searchQuery);
      searchResults = results.filter(
        (u: any) => !friendList.find((f) => f.id === u.id)
      );
    } catch (e) {
      console.error('Failed to search users', e);
      searchResults = [];
    }
  }

  async function sendFriendRequest(userId: string, username: string) {
    try {
      await api.sendFriendRequest(userId);
      searchResults = searchResults.filter((u) => u.id !== userId);
      await loadFriendRequests();
    } catch (e) {
      console.error('Failed to send friend request', e);
    }
  }

  async function acceptFriendRequest(requestId: string, sender: any) {
    try {
      await api.acceptFriendRequest(requestId);
      await loadFriendRequests();
      await loadFriendsFromDB();
    } catch (e) {
      console.error('Failed to accept friend request', e);
    }
  }

  async function declineFriendRequest(requestId: string) {
    try {
      await api.declineFriendRequest(requestId);
      await loadFriendRequests();
    } catch (e) {
      console.error('Failed to decline friend request', e);
    }
  }

  async function removeFriend(userId: string) {
    try {
      await api.removeFriend(userId);
      friends.set(friendList.filter((f) => f.id !== userId));
    } catch (e) {
      console.error('Failed to remove friend', e);
    }
  }

  function openMessageModal(friend: Friend) {
    selectedFriend = friend;
    showMessageModal = true;
    loadDirectMessages(friend.id);
  }

  async function loadDirectMessages(friendId: string) {
    try {
      const msgs = await api.getDirectMessages(friendId);
      if (msgs && Array.isArray(msgs)) {
        conversations[friendId] = msgs.map((m: any) => ({
          id: m.id,
          content: m.content,
          senderId: m.senderId,
          receiverId: m.receiverId,
          createdAt: m.createdAt,
        }));
      } else {
        conversations[friendId] = [];
      }
    } catch (e) {
      console.error('Failed to load messages', e);
      conversations[friendId] = [];
    }
  }

  function closeMessageModal() {
    showMessageModal = false;
    selectedFriend = null;
    messageText = '';
  }

  async function sendMessage() {
    if (!messageText.trim() || !selectedFriend) return;
    try {
      await api.sendDirectMessage(selectedFriend.id, messageText);
      // Reload messages after sending
      await loadDirectMessages(selectedFriend.id);
      messageText = '';
    } catch (e) {
      console.error('Failed to send message', e);
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'online': return '#00ff88';
      case 'do-not-disturb': return '#ff454a';
      case 'away': return '#ffd700';
      default: return '#5a5a6a';
    }
  }
</script>

<div class="friends-page">
  <div class="friends-header">
    <h2>Amigos</h2>
    <div class="friends-actions">
      <span class="friends-count">{friendList.length} amigos</span>
      <button class="btn-refresh" onclick={loadFriendRequests} disabled={isLoading}>
        {isLoading ? '⟳' : '↻'}
      </button>
      <button class="btn-add-friend" onclick={toggleAddModal}>+ Adicionar</button>
    </div>
  </div>

  {#if friendRequests.length > 0}
    <div class="friend-requests-section">
      <h3 class="requests-title">Pedidos recebidos ({friendRequests.length})</h3>
      <div class="friend-requests-list">
        {#each friendRequests as request (request.id)}
          <div class="request-card">
            <div class="request-avatar">
              {#if request.sender?.avatarUrl}
                <img src={getUploadUrl(request.sender.avatarUrl)} alt={request.sender.username} />
              {:else}
                <span>{request.sender?.username?.[0]?.toUpperCase() || '?'}</span>
              {/if}
            </div>
            <div class="request-info">
              <span class="request-name">{request.sender?.username || 'Unknown'}</span>
              <span class="request-text">quer ser seu amigo</span>
            </div>
            <div class="request-actions">
              <button class="btn-accept" onclick={() => acceptFriendRequest(request.id, request.sender)}>Aceitar</button>
              <button class="btn-decline" onclick={() => declineFriendRequest(request.id)}>Recusar</button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if sentRequests.length > 0}
    <div class="friend-requests-section">
      <h3 class="requests-title">Pedidos enviados ({sentRequests.length})</h3>
      <div class="friend-requests-list">
        {#each sentRequests as request (request.id)}
          <div class="request-card sent">
            <div class="request-avatar">
              {#if request.receiver?.avatarUrl}
                <img src={getUploadUrl(request.receiver.avatarUrl)} alt={request.receiver.username} />
              {:else}
                <span>{request.receiver?.username?.[0]?.toUpperCase() || '?'}</span>
              {/if}
            </div>
            <div class="request-info">
              <span class="request-name">{request.receiver?.username || 'Unknown'}</span>
              <span class="request-text">Pedido enviado - aguardando</span>
            </div>
            <div class="request-actions">
              <span class="pending-badge">Pendente</span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="friends-grid">
    {#if friendList.length === 0}
      <div class="empty-state">
        <span class="empty-icon">👥</span>
        <p>Você ainda não tem amigos.</p>
        <p class="empty-hint">Clique em "+ Adicionar" para buscar amigos!</p>
      </div>
    {:else}
      {#each friendList as friend (friend.id)}
        <div class="friend-card">
          <div class="friend-avatar" onclick={() => openMessageModal(friend)} style="cursor: pointer;">
            {#if friend.avatarUrl}
              <img src={getUploadUrl(friend.avatarUrl)} alt={friend.username} class="avatar-img" />
            {:else}
              <div class="avatar-placeholder">{friend.username?.[0]?.toUpperCase() || '?'}</div>
            {/if}
            <div
              class="status-dot"
              style="background-color: {getStatusColor(onlineUsers[friend.id] || friend.status)}"
            ></div>
          </div>

          <div class="friend-info">
            <div class="friend-username">{friend.username}</div>
            <div class="friend-activity">{friend.activity || ''}</div>
          </div>

          <button class="btn-message-friend" title="Mensagem" onclick={() => openMessageModal(friend)}>💬</button>
          <button class="btn-remove-friend" title="Remover amigo" onclick={() => removeFriend(friend.id)}>✕</button>
        </div>
      {/each}
    {/if}
  </div>
</div>

{#if showAddModal}
  <div class="modal-backdrop" onclick={toggleAddModal}>
    <div class="add-friend-modal" onclick={(e) => e.stopPropagation()}>
      <h3>Adicionar amigo</h3>
      <div class="search-row">
        <input
          type="text"
          placeholder="Buscar por username..."
          bind:value={searchQuery}
          class="modal-input"
          onkeydown={(e) => e.key === 'Enter' && searchUsers()}
        />
        <button class="btn-search" onclick={searchUsers}>Buscar</button>
      </div>
      <div class="search-results">
        {#each searchResults as user (user.id)}
          <div class="search-result">
            <div class="result-avatar">
              {#if user.avatarUrl}
                <img src={getUploadUrl(user.avatarUrl)} alt={user.username} />
              {:else}
                <span>{user.username?.[0]?.toUpperCase() || '?'}</span>
              {/if}
            </div>
            <span class="result-name">{user.username}</span>
            <button class="btn-add" onclick={() => sendFriendRequest(user.id, user.username)}>Enviar pedido</button>
          </div>
        {/each}
        {#if searchQuery && searchResults.length === 0}
          <p class="no-results">Nenhum usuário encontrado.</p>
        {/if}
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick={toggleAddModal}>Fechar</button>
      </div>
    </div>
  </div>
{/if}

{#if showMessageModal && selectedFriend}
  <div class="modal-backdrop" onclick={closeMessageModal}>
    <div class="message-modal" onclick={(e) => e.stopPropagation()}>
      <div class="message-header">
        <div class="message-recipient">
          <div class="recipient-avatar">
            {#if selectedFriend.avatarUrl}
              <img src={getUploadUrl(selectedFriend.avatarUrl)} alt={selectedFriend.username} />
            {:else}
              <span>{selectedFriend.username?.[0]?.toUpperCase() || '?'}</span>
            {/if}
          </div>
          <span class="recipient-name">{selectedFriend.username}</span>
        </div>
        <button class="btn-close" onclick={closeMessageModal}>✕</button>
      </div>
      <div class="message-list">
        {#if conversations[selectedFriend.id] && conversations[selectedFriend.id].length > 0}
          {#each conversations[selectedFriend.id] as msg (msg.id)}
            <div class="message-bubble" class:own={msg.senderId === get(user)?.id}>
              <span>{msg.content}</span>
            </div>
          {/each}
        {:else}
          <p class="no-messages">Nenhuma mensagem ainda. Diga olá!</p>
        {/if}
      </div>
      <div class="message-input-row">
        <input
          type="text"
          placeholder="Digite uma mensagem..."
          bind:value={messageText}
          class="message-input-field"
          onkeydown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button class="btn-send" onclick={sendMessage}>➤</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .friends-page {
    padding: 24px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .friends-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .friends-header h2 {
    font-size: 20px;
    font-weight: 600;
    color: #e4e6eb;
  }

  .friends-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-refresh {
    width: 32px;
    height: 32px;
    border: 1px solid #2a2b2f;
    border-radius: 6px;
    background: transparent;
    color: #8e9297;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s;
  }

  .btn-refresh:hover {
    border-color: #0099ff;
    color: #0099ff;
  }

  .btn-refresh:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .friends-count {
    font-size: 13px;
    color: #8e9297;
  }

  .btn-add-friend {
    padding: 6px 16px;
    background: #0099ff;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-add-friend:hover {
    background: #0080e0;
  }

  .friend-requests-section {
    margin-bottom: 24px;
    padding: 16px;
    background: #111116;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
  }

  .requests-title {
    font-size: 13px;
    font-weight: 600;
    color: #8e9297;
    margin-bottom: 12px;
  }

  .friend-requests-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .request-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 8px;
  }

  .request-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50% 50% 15% 50%;
    background: #2a2b2f;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    color: #0099ff;
    flex-shrink: 0;
  }

  .request-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .request-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .request-name {
    font-size: 13px;
    font-weight: 600;
  }

  .request-text {
    font-size: 11px;
    color: #8e9297;
  }

  .request-actions {
    display: flex;
    gap: 8px;
  }

  .btn-accept {
    padding: 6px 12px;
    background: #0099ff;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
  }

  .btn-accept:hover {
    background: #0080e0;
  }

  .btn-decline {
    padding: 6px 12px;
    background: transparent;
    color: #8e9297;
    border: 1px solid #2a2b2f;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
  }

  .btn-decline:hover {
    background: #22222a;
  }

  .request-card.sent {
    opacity: 0.8;
  }

  .pending-badge {
    padding: 6px 12px;
    background: #2a2b2f;
    color: #8e9297;
    border-radius: 6px;
    font-size: 11px;
  }

  .friends-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 12px;
  }

  .friend-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px;
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    height: 72px;
    transition: all 0.2s;
    position: relative;
  }

  .friend-card:hover {
    border-color: #0099ff;
    background: #22222a;
  }

  .friend-card:hover .btn-remove-friend {
    opacity: 1;
  }

  .friend-card:hover .btn-message-friend {
    opacity: 1;
  }

  .btn-message-friend {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #8e9297;
    font-size: 14px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s, background 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-message-friend:hover {
    background: #0099ff20;
    color: #0099ff;
  }

  .message-modal {
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    width: 400px;
    height: 500px;
    display: flex;
    flex-direction: column;
  }

  .message-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid #2a2b2f;
  }

  .message-recipient {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .recipient-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50% 50% 15% 50%;
    background: #2a2b2f;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    color: #0099ff;
  }

  .recipient-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .recipient-name {
    font-size: 14px;
    font-weight: 600;
  }

  .btn-close {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #8e9297;
    cursor: pointer;
    font-size: 14px;
  }

  .btn-close:hover {
    background: #22222a;
  }

  .message-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .message-bubble {
    max-width: 70%;
    padding: 8px 12px;
    border-radius: 12px;
    background: #2a2b2f;
    align-self: flex-start;
    font-size: 13px;
  }

  .message-bubble.own {
    background: #0099ff;
    align-self: flex-end;
  }

  .no-messages {
    text-align: center;
    color: #8e9297;
    font-size: 13px;
    margin-top: 40px;
  }

  .message-input-row {
    display: flex;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid #2a2b2f;
  }

  .message-input-field {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #2a2b2f;
    border-radius: 8px;
    background: #0f0f12;
    color: #e4e6eb;
    font-size: 13px;
    outline: none;
  }

  .message-input-field:focus {
    border-color: #0099ff;
  }

  .btn-send {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: #0099ff;
    color: white;
    cursor: pointer;
    font-size: 14px;
  }

  .btn-send:hover {
    background: #0080e0;
  }

  .btn-remove-friend {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 50%;
    background: #ff454a;
    color: white;
    font-size: 12px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-remove-friend:hover {
    background: #cc3338;
  }

  .friend-avatar {
    position: relative;
    width: 48px;
    height: 48px;
    flex-shrink: 0;
  }

  .avatar-img,
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    border-radius: 50% 50% 15% 50%;
    object-fit: cover;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
  }

  .avatar-placeholder {
    background: #0099ff;
    color: white;
    font-size: 18px;
  }

  .status-dot {
    position: absolute;
    bottom: 4%;
    right: 4%;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid #1a1a1f;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
  }

  .status-dot.online {
    background: #00ff88 !important;
  }

  .friend-info {
    flex: 1;
    min-width: 0;
  }

  .friend-username {
    font-size: 14px;
    font-weight: 600;
    color: #e4e6eb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .friend-activity {
    font-size: 12px;
    color: #8e9297;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .add-friend-modal {
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    padding: 24px;
    width: 400px;
    max-height: 500px;
    display: flex;
    flex-direction: column;
  }

  .add-friend-modal h3 {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 16px;
  }

  .search-row {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .modal-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #2a2b2f;
    border-radius: 6px;
    background: #0f0f12;
    color: #e4e6eb;
    font-size: 14px;
    outline: none;
  }

  .modal-input:focus {
    border-color: #0099ff;
  }

  .btn-search {
    padding: 8px 16px;
    background: #0099ff;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .search-results {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .search-result {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: #111116;
    border: 1px solid #2a2b2f;
    border-radius: 8px;
  }

  .result-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50% 50% 15% 50%;
    background: #2a2b2f;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    color: #0099ff;
    flex-shrink: 0;
  }

  .result-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .result-name {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
  }

  .btn-add {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    background: #0099ff;
    color: white;
    font-size: 12px;
    cursor: pointer;
  }

  .btn-add:hover {
    background: #0080e0;
  }

  .no-results {
    text-align: center;
    color: #8e9297;
    font-size: 13px;
    padding: 20px;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-secondary {
    background: transparent;
    color: #8e9297;
    border: 1px solid #2a2b2f;
  }
</style>
