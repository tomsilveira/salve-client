<script lang="ts">
  import { onMount } from 'svelte';
  import { user, token, clearAuth } from './lib/stores';
  import { request } from './lib/api';

  let currentUser: any = null;
  let currentToken: string | null = null;
  let showChangePassword = false;
  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let error = '';
  let success = '';

  user.subscribe((u) => (currentUser = u));
  token.subscribe((t) => (currentToken = t));

  function handleLogout() {
    clearAuth();
    window.location.reload();
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      error = 'Senhas não conferem';
      return;
    }
    if (newPassword.length < 6) {
      error = 'A senha deve ter pelo menos 6 caracteres';
      return;
    }

    error = '';
    success = '';

    try {
      await request(`/users/${currentUser.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      success = 'Senha alterada com sucesso!';
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      showChangePassword = false;
    } catch (e: any) {
      error = e.message || 'Erro ao alterar senha';
    }
  }
</script>

<div class="settings-page">
  <h2>Configurações</h2>

  <div class="settings-section">
    <h3>Conta</h3>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">Nome de usuário</span>
        <span class="setting-value">{currentUser?.username || ''}</span>
      </div>
      <span class="setting-badge">Pro</span>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">E-mail</span>
        <span class="setting-value">{currentUser?.email || ''}</span>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">ID do usuário</span>
        <span class="setting-value">{currentUser?.id || ''}</span>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">Alterar senha</span>
      </div>
      <button class="btn-link" onclick={() => (showChangePassword = true)}>Alterar</button>
    </div>

    <div class="setting-item danger">
      <div class="setting-info">
        <span class="setting-label">Desconectar</span>
      </div>
      <button class="btn-link danger" onclick={handleLogout}>Sair</button>
    </div>
  </div>

  <div class="settings-section">
    <h3>Aparência</h3>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">Tema</span>
        <span class="setting-value">Escuro (padrão)</span>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">Tamanho da fonte</span>
        <span class="setting-value">Normal</span>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">Animações</span>
        <span class="setting-value">Ativadas</span>
      </div>
    </div>
  </div>

  <div class="settings-section">
    <h3>Áudio</h3>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">Notificações de áudio</span>
        <span class="setting-value">Ativadas</span>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">Echo cancellation</span>
        <span class="setting-value">Ativado</span>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">Notificações de mensagem</span>
        <span class="setting-value">Ativadas</span>
      </div>
    </div>
  </div>
</div>

{#if showChangePassword}
  <div class="modal-backdrop" onclick={() => (showChangePassword = false)}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h3>Alterar senha</h3>

      {#if error}
        <div class="error">{error}</div>
      {/if}
      {#if success}
        <div class="success">{success}</div>
      {/if}

      <div class="form-group">
        <input
          type="password"
          placeholder="Senha atual"
          bind:value={currentPassword}
          class="input-field"
        />
      </div>

      <div class="form-group">
        <input
          type="password"
          placeholder="Nova senha"
          bind:value={newPassword}
          class="input-field"
        />
      </div>

      <div class="form-group">
        <input
          type="password"
          placeholder="Confirmar nova senha"
          bind:value={confirmPassword}
          class="input-field"
        />
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" onclick={() => (showChangePassword = false)}>Cancelar</button>
        <button class="btn btn-primary" onclick={handleChangePassword}>Salvar</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-page {
    padding: 24px;
    max-width: 800px;
    margin: 0 auto;
  }

  .settings-page h2 {
    font-size: 20px;
    font-weight: 600;
    color: #e4e6eb;
    margin-bottom: 24px;
  }

  .settings-section {
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .settings-section h3 {
    font-size: 12px;
    font-weight: 600;
    color: #8e9297;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid #0f0f12;
  }

  .setting-item:last-child {
    border-bottom: none;
  }

  .setting-item.danger {
    color: #ff6b6b;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
  }

  .setting-label {
    font-size: 13px;
    color: #e4e6eb;
  }

  .setting-value {
    font-size: 11px;
    color: #8e9297;
    margin-top: 2px;
  }

  .setting-badge {
    font-size: 10px;
    color: #ffd700;
    background: #ffd70020;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 600;
  }

  .btn-link {
    background: transparent;
    border: none;
    color: #0099ff;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    padding: 4px 8px;
  }

  .btn-link:hover {
    text-decoration: underline;
  }

  .btn-link.danger {
    color: #ff6b6b;
  }

  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    padding: 24px;
    width: 360px;
  }

  .modal h3 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #e4e6eb;
  }

  .form-group {
    margin-bottom: 12px;
  }

  .input-field {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #2a2b2f;
    border-radius: 6px;
    background: #0f0f12;
    color: #e4e6eb;
    font-size: 14px;
    outline: none;
  }

  .input-field:focus {
    border-color: #0099ff;
  }

  .modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 20px;
  }

  .btn {
    padding: 6px 16px;
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

  .btn-secondary:hover {
    background: #22222a;
  }

  .btn-primary {
    background: #0099ff;
    color: white;
    border: none;
  }

  .btn-primary:hover {
    background: #0080e0;
  }

  .error {
    background: #ff453a20;
    border: 1px solid #ff453a40;
    color: #ff6b6b;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    margin-bottom: 16px;
  }

  .success {
    background: #00ff8820;
    border: 1px solid #00ff8840;
    color: #00ff88;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    margin-bottom: 16px;
  }
</style>
