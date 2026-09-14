let audioUnlocked = false;

export function unlockAudio() {
  if (audioUnlocked) return;
  try {
    const a = new Audio();
    a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    a.volume = 0.0;
    a.play().then(() => {
      audioUnlocked = true;
    }).catch(() => {});
  } catch {}
}

function play(path: string) {
  try {
    const a = new Audio(path);
    a.volume = 0.5;
    a.play().catch((e) => console.warn('[Sound] play failed:', path, e));
  } catch (e) {
    console.warn('[Sound] error:', path, e);
  }
}

export function playJoinSound() { console.log('[Sound] join'); play('/sounds/Entrou.mp3'); }
export function playLeaveSound() { console.log('[Sound] leave'); play('/sounds/Saiu.mp3'); }
export function playScreenStartSound() { console.log('[Sound] screen start'); play('/sounds/Abriu.mp3'); }
export function playScreenStopSound() { console.log('[Sound] screen stop'); play('/sounds/Fechou.mp3'); }
