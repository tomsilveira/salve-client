<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { news, serverCustomization, user, refreshMembers, clearAuth } from './lib/stores';
  import type { NewsItem, ServerCustomization, User } from './lib/types';
  import { api, getUploadUrl } from './lib/api';

  let newsItems: NewsItem[] = [];
  let loading = true;
  let customization: ServerCustomization = {
    bannerPosition: 'top',
    backgroundImage: '',
    wallColor: '#0f0f12',
  };
  let showCustomize = false;
  let wallColor = '#0f0f12';
  let backgroundFile: File | null = null;
  let backgroundPreview = '';

  const editNickname = false;
  let status = $state($user?.status || 'online');
  let animatedBorder = $state($user?.animatedBorder || false);
  let nickname = $state($user?.username || '');

  const newsSources = [
    { id: 'hackernews', name: 'Hacker News', emoji: '💻', category: 'Tech' },
    { id: 'github', name: 'GitHub Trending', emoji: '⭐', category: 'Dev' },
    { id: 'devto', name: 'Dev.to', emoji: '📝', category: 'Programming' },
  ];

  const statusOptions = [
    { value: 'online', label: 'Online', color: '#00ff88' },
    { value: 'away', label: 'Ausente', color: '#ffd700' },
    { value: 'do-not-disturb', label: 'Não perturbe', color: '#ff454a' },
    { value: 'invisible', label: 'Invisível', color: '#5a5a6a' },
  ];

  let enabledSources: string[] = $state(['hackernews']);
  let showSourceSelector = $state(false);

  function toggleSource(sourceId: string) {
    if (enabledSources.includes(sourceId)) {
      enabledSources = enabledSources.filter((s) => s !== sourceId);
    } else {
      enabledSources = [...enabledSources, sourceId];
    }
  }

  onMount(() => {
    loadNews();
    loadCustomization();
  });

  async function loadNews() {
    loading = true;
    newsItems = [];

    const promises: Promise<NewsItem[]>[] = [];

    if (enabledSources.includes('hackernews')) {
      promises.push(loadHackerNews());
    }
    if (enabledSources.includes('github')) {
      promises.push(loadGitHubTrending());
    }
    if (enabledSources.includes('devto')) {
      promises.push(loadDevTo());
    }

    if (promises.length === 0) {
      loading = false;
      return;
    }

    try {
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled') {
          newsItems = [...newsItems, ...result.value];
        }
      }
      news.set(newsItems);
    } catch (e) {
      console.error('Failed to load news', e);
    } finally {
      loading = false;
    }
  }

  async function loadHackerNews(): Promise<NewsItem[]> {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids: number[] = await res.json();
    const topIds = ids.slice(0, 6);
    const stories = await Promise.all(
      topIds.map(async (id) => {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        return r.json();
      })
    );
    return stories
      .filter((s) => s && s.title)
      .map((s: any) => ({
        id: `hn-${s.id}`,
        title: s.title,
        summary: s.text ? s.text.replace(/<[^>]*>/g, '').slice(0, 150) + '...' : `Por ${s.by} • ${s.score} pontos • ${s.descendants || 0} comentários`,
        category: 'Tech',
        imageUrl: `https://picsum.photos/seed/${s.id}/400/200`,
        source: 'Hacker News',
        url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
        createdAt: new Date(s.time * 1000).toISOString(),
      }));
  }

  async function loadGitHubTrending(): Promise<NewsItem[]> {
    try {
      const res = await fetch('https://api.github.com/search/repositories?q=created:>2026-01-01&sort=stars&order=desc&per_page=6');
      const data = await res.json();
      return (data.items || []).map((repo: any) => ({
        id: `gh-${repo.id}`,
        title: repo.full_name,
        summary: repo.description || 'Sem descrição',
        category: 'Dev',
        imageUrl: `https://picsum.photos/seed=${repo.id}/400/200`,
        source: 'GitHub',
        url: repo.html_url,
        createdAt: repo.created_at,
      }));
    } catch {
      return [];
    }
  }

  async function loadDevTo(): Promise<NewsItem[]> {
    try {
      const res = await fetch('https://dev.to/api/articles?per_page=6');
      const articles = await res.json();
      return articles.map((a: any) => ({
        id: `dev-${a.id}`,
        title: a.title,
        summary: a.description || '',
        category: 'Programming',
        imageUrl: a.cover_image || `https://picsum.photos/seed=${a.id}/400/200`,
        source: 'Dev.to',
        url: a.url,
        createdAt: a.created_at,
      }));
    } catch {
      return [];
    }
  }

  function loadCustomization() {
    const saved = localStorage.getItem('salve_room_customization');
    if (saved) {
      try {
        customization = JSON.parse(saved);
        wallColor = customization.wallColor;
        backgroundPreview = customization.backgroundImage || '';
      } catch {}
    }
    serverCustomization.set(customization);
  }

  function saveCustomization() {
    customization = { ...customization, wallColor, backgroundImage: backgroundPreview || '' };
    localStorage.setItem('salve_room_customization', JSON.stringify(customization));
    serverCustomization.set(customization);
    showCustomize = false;
  }

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      backgroundFile = input.files[0];
      backgroundPreview = URL.createObjectURL(backgroundFile);
    }
  }

  async function handleAvatarChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      try {
        const res = await api.uploadUserAvatar(file);
        const u = get(user);
        if (u) {
          u.avatarUrl = res.avatarUrl;
          user.set({ ...u });
        }
      } catch (err) {
        console.error('Failed to upload avatar', err);
      }
    }
  }

  function saveAllInfo() {
    const u = get(user);
    if (u) {
      const updated = { ...u, username: nickname, status, animatedBorder };
      user.set(updated);
      const safeUser = { id: updated.id, username: updated.username, email: updated.email, status: updated.status, createdAt: updated.createdAt };
      localStorage.setItem('salve_user', JSON.stringify(safeUser));
    }
    customization = { ...customization, wallColor, backgroundImage: backgroundPreview || '' };
    localStorage.setItem('salve_room_customization', JSON.stringify(customization));
    api.updateStatus(status);
    refreshMembers.update((n) => n + 1);
    showSaveToast = true;
    setTimeout(() => (showSaveToast = false), 2000);
  }

  function handleLogout() {
    clearAuth();
    window.location.reload();
  }

  let showSaveToast = $state(false);

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  }
</script>

<div class="room-layout" style="background-color: {customization.wallColor}">
  {#if customization.backgroundImage}
    <div class="room-bg" style="background-image: url('{customization.backgroundImage}')"></div>
  {/if}

  <div class="room-left">
    <h3 class="profile-title">Sua Sala</h3>

    <div class="profile-card" class:animated-border={animatedBorder}>
      <div class="avatar-wrapper">
        {#if $user?.avatarUrl}
          <img src="{getUploadUrl($user.avatarUrl)}?t={Date.now()}" alt="avatar" class="avatar-img" />
        {:else}
          <div class="avatar-placeholder">{$user?.username?.[0]?.toUpperCase() || '?'}</div>
        {/if}
        <label class="avatar-edit" title="Alterar avatar">
          <input type="file" accept="image/*" onchange={handleAvatarChange} hidden />
          📷
        </label>
      </div>

        <div class="profile-field">
          <label>Nickname</label>
          <input
            type="text"
            bind:value={nickname}
            class="profile-input"
            placeholder="Digite seu nickname"
          />
        </div>

        <div class="profile-field">
          <label>Status</label>
          <div class="status-selector">
            {#each statusOptions as opt (opt.value)}
              <div
                class="status-option"
                class:selected={status === opt.value}
                onclick={() => (status = opt.value)}
                style="border-color: {opt.color}"
              >
                <div class="status-dot" style="background-color: {opt.color}"></div>
                <span>{opt.label}</span>
              </div>
            {/each}
          </div>
        </div>

      <div class="profile-field">
        <label class="checkbox-row">
          <input type="checkbox" bind:checked={animatedBorder} class="checkbox" />
          <span>Borda animada</span>
        </label>
      </div>

      <button class="btn-customize" onclick={() => (showCustomize = true)}>
        Personalizar parede
      </button>

      <button class="btn-save-all" onclick={saveAllInfo}>
        Salvar Informações
      </button>

      <button class="btn-logout" onclick={handleLogout}>
        Sair da conta
      </button>
    </div>
  </div>

  <div class="room-right">
    <div class="news-header">
      <h2>Feed de Notícias</h2>
      <button class="source-toggle" onclick={() => (showSourceSelector = !showSourceSelector)}>
        ⚙️ Fontes
      </button>
    </div>

    {#if showSourceSelector}
      <div class="source-selector">
        {#each newsSources as source (source.id)}
          <label class="source-option" class:enabled={enabledSources.includes(source.id)}>
            <input
              type="checkbox"
              checked={enabledSources.includes(source.id)}
              onchange={() => toggleSource(source.id)}
            />
            <span class="source-emoji">{source.emoji}</span>
            <span class="source-name">{source.name}</span>
          </label>
        {/each}
      </div>
    {/if}

    {#if loading}
      <div class="loading">Carregando notícias...</div>
    {:else}
      <div class="news-grid">
        {#each newsItems as item (item.id)}
          <a href={item.url} class="news-card" target="_blank" rel="noopener">
            <div class="news-image" style="background-image: url('{item.imageUrl}')"></div>
            <div class="news-content">
              <div class="news-category">{item.category}</div>
              <h3 class="news-title">{item.title}</h3>
              <p class="news-summary">{item.summary}</p>
              <div class="news-meta">
                <span class="news-source">{item.source}</span>
                <span class="news-time">{formatDate(item.createdAt)}</span>
              </div>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if showCustomize}
  <div class="modal-backdrop" onclick={() => (showCustomize = false)}>
    <div class="customize-modal" onclick={(e) => e.stopPropagation()}>
      <h3>Personalizar Sala</h3>

      <div class="customize-section">
        <label>Cor da parede</label>
        <div class="color-picker-row">
          <input type="color" bind:value={wallColor} />
          <input type="text" bind:value={wallColor} class="color-input" />
        </div>
      </div>

      <div class="customize-section">
        <label>Imagem de fundo</label>
        <input type="file" accept="image/*" onchange={handleFileChange} class="file-input" />
        {#if backgroundPreview}
          <div class="bg-preview" style="background-image: url('{backgroundPreview}')"></div>
        {/if}
      </div>

      <div class="customize-section">
        <label>Posição do banner</label>
        <select bind:value={customization.bannerPosition}>
          <option value="top">Superior</option>
          <option value="middle">Meio</option>
          <option value="bottom">Inferior</option>
        </select>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" onclick={() => (showCustomize = false)}>Cancelar</button>
        <button class="btn btn-primary" onclick={saveCustomization}>Salvar</button>
      </div>
    </div>
  </div>
{/if}

{#if showSaveToast}
  <div class="save-toast">✓ Informações salvas com sucesso!</div>
{/if}

<style>
  .room-layout {
    height: calc(100vh - 52px);
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .room-bg {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-size: cover;
    background-position: center;
    opacity: 0.1;
  }

  .room-left {
    width: 50%;
    padding: 24px;
    overflow-y: auto;
    z-index: 1;
  }

  .room-right {
    width: 50%;
    padding: 24px;
    overflow-y: auto;
    border-left: 1px solid #2a2b2f;
    z-index: 1;
  }

  .profile-title {
    font-size: 14px;
    color: #8e9297;
    margin-bottom: 16px;
  }

  .profile-card {
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 16px;
    padding: 24px;
    max-width: 320px;
    margin: 0 auto;
  }

  .profile-card.animated-border {
    border-color: #0099ff;
    box-shadow:
      0 0 10px #0099ff,
      inset 0 0 20px rgba(0, 153, 255, 0.2);
    animation: border-glow 2s ease-in-out infinite;
  }

  @keyframes border-glow {
    0%, 100% { box-shadow: 0 0 5px #0099ff, inset 0 0 10px rgba(0, 153, 255, 0.1); }
    50% { box-shadow: 0 0 20px #0099ff, inset 0 0 30px rgba(0, 153, 255, 0.3); }
  }

  .avatar-wrapper {
    position: relative;
    width: 96px;
    height: 96px;
    margin: 0 auto 20px;
    border-radius: 50% 50% 15% 50%;
    border: 3px solid #2a2b2f;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar-img,
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar-placeholder {
    background: #0099ff;
    color: white;
    font-size: 36px;
    font-weight: 700;
  }

  .avatar-edit {
    position: absolute;
    bottom: 4%;
    right: 4%;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #19304088;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    cursor: pointer;
    border: 2px solid #1a1a1f;
    transition: all 0.2s;
  }

  .avatar-edit:hover {
    background: #0080e0;
    transform: scale(1.1);
  }

  .profile-field {
    margin-bottom: 16px;
  }

  .profile-field label {
    display: block;
    font-size: 12px;
    color: #8e9297;
    margin-bottom: 6px;
  }

  .field-row {
    display: flex;
    gap: 6px;
  }

  .profile-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #2a2b2f;
    border-radius: 6px;
    background: #0f0f12;
    color: #e4e6eb;
    font-size: 13px;
    outline: none;
  }

  .profile-input:focus {
    border-color: #0099ff;
  }

  .save-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #8e9297;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .save-btn:hover {
    color: #0099ff;
  }

  .status-selector {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .status-option {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 1px solid #2a2b2f;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  .status-option:hover {
    border-color: #0099ff;
  }

  .status-option.selected {
    background: #0099ff20;
    border-color: #0099ff;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
    color: #e4e6eb;
  }

  .checkbox {
    width: 14px;
    height: 14px;
    cursor: pointer;
  }

  .btn-customize {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #2a2b2f;
    border-radius: 8px;
    background: transparent;
    color: #8e9297;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 4px;
  }

  .btn-customize:hover {
    background: #22222a;
    color: #0099ff;
    border-color: #0099ff;
  }

  .btn-save-all {
    width: 100%;
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    background: #0099ff;
    color: white;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    margin-top: 8px;
  }

  .btn-save-all:hover {
    background: #0080e0;
  }

  .btn-logout {
    width: 100%;
    padding: 10px 16px;
    border: 1px solid #ff454a;
    border-radius: 8px;
    background: transparent;
    color: #ff454a;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 8px;
  }

  .btn-logout:hover {
    background: #ff454a;
    color: white;
  }

  .save-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: #00cc66;
    color: white;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    z-index: 1000;
    animation: fadeInUp 0.3s ease;
  }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .news-header {
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .source-toggle {
    padding: 4px 10px;
    border: 1px solid #2a2b2f;
    border-radius: 6px;
    background: transparent;
    color: #8e9297;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .source-toggle:hover {
    border-color: #0099ff;
    color: #0099ff;
  }

  .source-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 20px;
    padding: 12px;
    background: #111116;
    border: 1px solid #2a2b2f;
    border-radius: 8px;
  }

  .source-option {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid #2a2b2f;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    font-size: 12px;
    color: #8e9297;
    transition: all 0.2s;
  }

  .source-option input {
    display: none;
  }

  .source-option.enabled {
    border-color: #0099ff;
    background: #0099ff20;
    color: #e4e6eb;
  }

  .source-emoji {
    font-size: 14px;
  }

  .news-header h2 {
    font-size: 20px;
    font-weight: 600;
    color: #e4e6eb;
  }

  .news-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .news-card {
    display: block;
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s;
  }

  .news-card:hover {
    border-color: #0099ff;
    transform: translateY(-2px);
  }

  .news-image {
    width: 100%;
    height: 120px;
    background-size: cover;
    background-position: center;
  }

  .news-content {
    padding: 16px;
  }

  .news-category {
    display: inline-block;
    padding: 2px 8px;
    background: #0099ff20;
    color: #0099ff;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .news-title {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 6px;
    color: #e4e6eb;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .news-summary {
    font-size: 12px;
    color: #8e9297;
    line-height: 1.5;
    margin: 0 0 12px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .news-meta {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #5a5a6a;
  }

  .loading {
    padding: 40px;
    text-align: center;
    color: #8e9297;
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

  .customize-modal {
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    padding: 24px;
    width: 400px;
  }

  .customize-modal h3 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #e4e6eb;
  }

  .customize-section {
    margin-bottom: 16px;
  }

  .customize-section label {
    display: block;
    font-size: 12px;
    color: #8e9297;
    margin-bottom: 6px;
  }

  .color-picker-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .color-picker-row input[type="color"] {
    width: 36px;
    height: 28px;
    border: 1px solid #2a2b2f;
    border-radius: 4px;
    background: none;
    cursor: pointer;
    padding: 0;
  }

  .color-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #2a2b2f;
    border-radius: 6px;
    background: #0f0f12;
    color: #e4e6eb;
    font-size: 13px;
    outline: none;
  }

  .file-input {
    font-size: 13px;
    color: #8e9297;
  }

  .bg-preview {
    width: 100%;
    height: 100px;
    background-size: cover;
    background-position: center;
    border: 1px solid #2a2b2f;
    border-radius: 8px;
    margin-top: 8px;
  }

  .customize-section select {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid #2a2b2f;
    border-radius: 6px;
    background: #0f0f12;
    color: #e4e6eb;
    font-size: 13px;
    outline: none;
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
</style>
