<script lang="ts">
const { onclose = () => {}, oncreate = () => {} } = $props();

let name = $state('');
let description = $state('');
let iconFile: File | null = null;
let iconPreview = $state('');

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    iconFile = input.files[0];
    iconPreview = URL.createObjectURL(iconFile);
  }
}

function removeIcon() {
  iconFile = null;
  iconPreview = '';
}
</script>

<div class="modal-backdrop" onclick={() => onclose()}>
  <div class="create-server-modal" onclick={(e) => e.stopPropagation()}>
    <h3>Criar servidor</h3>
    <p class="modal-desc">Comece uma nova comunidade no Salve</p>

    <input
      type="text"
      placeholder="Nome do servidor"
      bind:value={name}
      class="modal-input"
    />
    <textarea
      placeholder="Descrição (opcional)"
      bind:value={description}
      class="modal-input modal-textarea"
      rows="3"
    ></textarea>

    <div class="icon-section">
      <label class="icon-label">Ícone do servidor (opcional)</label>
      <label class="icon-upload">
          <input type="file" accept="image/*" onchange={handleFileChange} hidden />
        {#if iconPreview}
          <img src={iconPreview} alt="preview" class="icon-preview" />
        {:else}
          <span class="icon-placeholder">📎</span>
        {/if}
      </label>
      {#if iconPreview}
        <button class="icon-remove" onclick={removeIcon} title="Remover">✕</button>
      {/if}
    </div>

    <div class="modal-actions">
      <button class="btn btn-secondary" onclick={() => onclose()}>Cancelar</button>
      <button
        class="btn btn-primary"
        onclick={() => {
          if (name.trim()) {
            oncreate({
              name: name.trim(),
              description: description.trim(),
              iconFile,
            });
          }
        }}
        disabled={!name.trim()}
      >Criar</button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .create-server-modal {
    background: #1a1a1f;
    border: 1px solid #2a2b2f;
    border-radius: 12px;
    padding: 24px;
    width: 400px;
  }

  .create-server-modal h3 { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
  .modal-desc { font-size: 13px; color: #8e9297; margin-bottom: 20px; }

  .modal-input {
    width: 100%; padding: 10px 14px; border: 1px solid #2a2b2f;
    border-radius: 8px; background: #0f0f12; color: #e4e6eb;
    font-size: 14px; outline: none; transition: border-color 0.2s; margin-bottom: 12px;
  }
  .modal-input:focus { border-color: #0099ff; }
  .modal-textarea { resize: vertical; min-height: 80px; }

  .icon-section {
    margin-bottom: 20px;
  }

  .icon-label {
    display: block;
    font-size: 12px;
    color: #8e9297;
    margin-bottom: 8px;
  }

  .icon-upload {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    border: 2px dashed #2a2b2f;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .icon-upload:hover {
    border-color: #0099ff;
    background: #0f0f12;
  }

  .icon-placeholder {
    font-size: 24px;
    color: #8e9297;
  }

  .icon-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 10px;
  }

  .icon-remove {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: none;
    background: #ff454a;
    color: white;
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
  .btn { padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; }
  .btn-secondary { background: transparent; color: #8e9297; border: 1px solid #2a2b2f; }
  .btn-secondary:hover { background: #22222a; }
  .btn-primary { background: #0099ff; color: white; border: none; }
  .btn-primary:hover:not(:disabled) { background: #0080e0; }
  .btn-primary:disabled { opacity: 0.5; cursor: default; }
</style>
