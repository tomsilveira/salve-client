<svelte:head>
  <link href="https://fonts.googleapis.com/css2?family=Yesteryear&display=swap" rel="stylesheet" />
</svelte:head>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { api } from './lib/api';
  import { user, token, servers, saveAuth } from './lib/stores';
  import type { User, Server } from './lib/types';

  let isRegister = false;
  let username = '';
  let email = '';
  let password = '';
  let confirmPassword = '';
  let error = '';
  let loading = false;
  let serverList: Server[] = [];

  onMount(() => {
    loadServers();
  });

  async function loadServers() {
    try {
      serverList = await api.getServers();
      servers.set(serverList);
    } catch (e) {
      console.error('Failed to load servers', e);
    }
  }

  async function handleSubmit() {
    if (loading) return;
    error = '';
    loading = true;

    try {
      if (isRegister) {
        if (password !== confirmPassword) {
          error = 'Senhas não conferem';
          loading = false;
          return;
        }
        await api.register(username, email, password);
      }

      const res = await api.login(username, password);
      const u: User = { id: res.userId, username: res.username, email, avatarUrl: res.avatarUrl || '', createdAt: '' };
      saveAuth(res.token, u);
      await loadServers();
      window.location.reload();
    } catch (err: any) {
      error = err.message || 'Erro ao fazer login';
    } finally {
      loading = false;
    }
  }

  async function handleKeyPress(e: KeyboardEvent) {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      await handleSubmit();
    }
  }
</script>

<div class="login-container">
  <div class="login-card">
    <div class="logo">
      <img src="/favicon.ico" alt="Salve" class="logo-icon" />
      <span class="logo-text">Salve</span>
    </div>

    <h1 class="title">{isRegister ? 'Criar conta' : 'Bem-vindo ao Salve'}</h1>
    <p class="subtitle">Conectando comunidades brasileiras</p>

    {#if error}
      <div class="error">{error}</div>
    {/if}

    <form onkeydown={handleKeyPress}>
      <div class="form-group">
        <input
          type="text"
          placeholder="Nome de usuário"
          bind:value={username}
          class="input-field"
          autocomplete="username"
        />
      </div>

      {#if isRegister}
        <div class="form-group">
          <input
            type="email"
            placeholder="E-mail"
            bind:value={email}
            class="input-field"
            autocomplete="email"
          />
        </div>
      {/if}

      <div class="form-group">
        <input
          type="password"
          placeholder="Senha"
          bind:value={password}
          class="input-field"
          autocomplete={isRegister ? "new-password" : "current-password"}
        />
      </div>

      {#if isRegister}
        <div class="form-group">
          <input
            type="password"
            placeholder="Confirmar senha"
            bind:value={confirmPassword}
            class="input-field"
            autocomplete="new-password"
          />
        </div>
      {/if}

      <button class="btn-primary" onclick={(e) => { e.preventDefault(); handleSubmit(); }} disabled={loading}>
        {loading ? 'Carregando...' : isRegister ? 'Criar conta' : 'Entrar'}
      </button>
    </form>

    <div class="toggle-form">
      <button class="btn-link" onclick={() => isRegister = !isRegister}>
        {isRegister ? 'Já tem conta? Entrar' : 'Não tem conta? Criar conta'}
      </button>
    </div>
  </div>
</div>

<style>
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #0f0f12 0%, #1a1a2e 100%);
  }

  .login-card {
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    padding: 40px;
    width: 360px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  }

  .logo {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin-bottom: 24px;
  }

  .logo-icon {
    width: 40px;
    height: 40px;
  }

  .logo-text {
    font-family: 'Yesteryear', cursive;
    font-size: 32px;
    font-weight: 700;
    color: #0099ff;
    letter-spacing: -0.5px;
  }

  .title {
    font-size: 20px;
    font-weight: 600;
    text-align: center;
    margin-bottom: 4px;
  }

  .subtitle {
    text-align: center;
    color: #8e9297;
    font-size: 13px;
    margin-bottom: 24px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .input-field {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid #2a2b2f;
    border-radius: 8px;
    background: #0f0f12;
    color: #e4e6eb;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .input-field:focus {
    border-color: #0099ff;
  }

  .btn-primary {
    width: 100%;
    padding: 10px;
    border: none;
    border-radius: 8px;
    background: #0099ff;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    background: #0080e0;
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .btn-link {
    width: 100%;
    padding: 8px;
    border: none;
    background: transparent;
    color: #0099ff;
    font-size: 13px;
    cursor: pointer;
    text-align: center;
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

  .toggle-form {
    margin-top: 16px;
    text-align: center;
  }
</style>
