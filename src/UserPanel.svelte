<script lang="ts">
  import { clearAuth, user as userStore, refreshMembers } from './lib/stores';
  import type { User } from './lib/types';
  import { api, getUploadUrl } from './lib/api';

  const { user, onClose, signalClient = null } = $props();

  let avatarFile = $state<File | null>(null);
  let avatarPreview = $state('');
  let uploading = $state(false);
  let currentStatus = $state(user.status || 'online');
  let updatingStatus = $state(false);

  const statuses = [
    { id: 'online', label: 'Online', desc: 'Disponível para conversar', color: '#00ff88' },
    { id: 'away', label: 'Ausente', desc: 'Afastado temporariamente', color: '#ffd700' },
    { id: 'do-not-disturb', label: 'Ocupado', desc: 'Não perturbar', color: '#ff454a' },
    { id: 'invisible', label: 'Invisível', desc: 'Aparecer como offline', color: '#5a5a6a' },
  ];

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      avatarFile = input.files[0];
      avatarPreview = URL.createObjectURL(avatarFile);
    }
  }

  async function uploadAvatar() {
    if (!avatarFile) return;
    uploading = true;
    try {
      const res = await api.uploadUserAvatar(avatarFile);
      user.avatarUrl = res.avatarUrl;
      userStore.set(user);
      localStorage.setItem('salve_user', JSON.stringify(user));
      refreshMembers.update((n) => n + 1);
      avatarFile = null;
      avatarPreview = '';
    } catch (e) {
      console.error('Failed to upload avatar', e);
    } finally {
      uploading = false;
    }
  }

  async function handleSelectStatus(statusId: string) {
    currentStatus = statusId;
    user.status = statusId;
    const updatedUser = { ...user, status: statusId };
    userStore.set(updatedUser);
    localStorage.setItem('salve_user', JSON.stringify(updatedUser));
    updatingStatus = true;
    try {
      await api.updateStatus(statusId);
      if (signalClient) {
        signalClient.updateStatus(statusId);
      }
      refreshMembers.update((n) => n + 1);
    } catch (e) {
      console.error('Failed to update status', e);
    } finally {
      updatingStatus = false;
    }
  }

  function handleLogout() {
    clearAuth();
    window.location.reload();
  }
</script>

<div class="panel-backdrop" onclick={onClose}>
  <div class="user-panel" onclick={(e) => e.stopPropagation()}>
    <div class="panel-header">
      <div class="panel-title">Perfil de usuário</div>
    </div>

    <div class="user-info">
      <div class="user-avatar-large">
        {#if avatarPreview}
          <img src={avatarPreview} alt="preview" class="avatar-preview" />
        {:else if user.avatarUrl}
          <img src={getUploadUrl(user.avatarUrl)} alt={user.username} class="avatar-preview" />
        {:else}
          {user.username?.[0]?.toUpperCase() || '?'}
        {/if}
        <div
          class="status-indicator-badge"
          style="background-color: {statuses.find((s) => s.id === currentStatus)?.color || '#00ff88'}"
        ></div>
        <label class="avatar-upload" title="Alterar avatar">
          <input type="file" accept="image/*" onchange={handleFileChange} hidden />
          📷
        </label>
      </div>
      <div class="user-details">
        <div class="user-username">{user.username}</div>
        <div class="user-email">{user.email}</div>
        <div class="user-id">ID: {user.id}</div>
        {#if avatarFile}
          <button class="btn btn-upload" onclick={uploadAvatar} disabled={uploading}>
            {uploading ? 'Enviando...' : 'Salvar avatar'}
          </button>
        {/if}
      </div>
    </div>

    <div class="panel-section">
      <div class="section-title">Definir Status</div>
      <div class="status-options">
        {#each statuses as s (s.id)}
          <div
            class="status-option"
            class:active={currentStatus === s.id}
            onclick={() => handleSelectStatus(s.id)}
          >
            <div class="status-dot-icon" style="background-color: {s.color};"></div>
            <div class="status-option-info">
              <span class="status-option-label">{s.label}</span>
              <span class="status-option-desc">{s.desc}</span>
            </div>
            {#if currentStatus === s.id}
              <span class="status-check">✓</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <div class="panel-section">
      <div class="section-title">Configurações futuras</div>
      <div class="setting-item">
        <span>Decoração de nome</span>
        <span class="coming-soon">Em breve</span>
      </div>
      <div class="setting-item">
        <span>Borda animada</span>
        <span class="coming-soon">Em breve</span>
      </div>
      <div class="setting-item">
        <span>Fonte personalizada</span>
        <span class="coming-soon">Em breve</span>
      </div>
    </div>

    <div class="panel-footer">
      <button class="btn btn-logout" onclick={handleLogout}>Sair</button>
    </div>
  </div>
</div>

<style>
  .panel-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    z-index: 100;
    padding-top: 56px;
  }

  .user-panel {
    width: 300px;
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    overflow: hidden;
    margin-right: 24px;
    margin-bottom: 24px;
  }

  .panel-header {
    padding: 16px;
    border-bottom: 1px solid #2a2b2f;
  }

  .panel-title {
    font-size: 14px;
    font-weight: 600;
    color: #8e9297;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
  }

  .user-avatar-large {
    width: 64px;
    height: 64px;
    border-radius: 50% 50% 15% 50%;
    background: #0099ff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 700;
    color: white;
    position: relative;
    overflow: hidden;
  }

  .avatar-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-upload {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.6);
    padding: 4px;
    text-align: center;
    font-size: 12px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .user-avatar-large:hover .avatar-upload {
    opacity: 1;
  }

  .user-details {
    flex: 1;
  }

  .user-username {
    font-size: 15px;
    font-weight: 600;
  }

  .user-email {
    font-size: 12px;
    color: #8e9297;
  }

  .user-id {
    font-size: 10px;
    color: #5a5a6a;
    font-family: monospace;
  }

  .panel-section {
    padding: 12px 16px;
    border-top: 1px solid #2a2b2f;
  }

  .status-indicator-badge {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid #1a1a1f;
    z-index: 2;
  }

  .status-options {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .status-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid transparent;
  }

  .status-option:hover {
    background: #22222a;
  }

  .status-option.active {
    background: #0099ff15;
    border-color: #0099ff40;
  }

  .status-dot-icon {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-option-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .status-option-label {
    font-size: 13px;
    font-weight: 500;
    color: #e4e6eb;
  }

  .status-option-desc {
    font-size: 11px;
    color: #8e9297;
  }

  .status-check {
    color: #0099ff;
    font-weight: 700;
    font-size: 14px;
  }

  .section-title {
    font-size: 11px;
    color: #8e9297;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    font-size: 13px;
    border-bottom: 1px solid #0f0f12;
  }

  .coming-soon {
    color: #8e9297;
    font-size: 11px;
  }

  .panel-footer {
    padding: 12px 16px;
    border-top: 1px solid #2a2b2f;
  }

  .btn {
    width: 100%;
    padding: 8px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-logout {
    background: transparent;
    color: #ff6b6b;
    border: 1px solid #ff454a40;
  }

  .btn-logout:hover {
    background: #ff454a20;
  }

  .btn-upload {
    margin-top: 8px;
    padding: 4px 8px;
    border-radius: 4px;
    border: none;
    background: #0099ff;
    color: white;
    font-size: 11px;
    cursor: pointer;
  }

  .btn-upload:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
