function getAudio(path: string): HTMLAudioElement {
  const a = new Audio(path);
  a.volume = 0.5;
  return a;
}

function play(path: string) {
  try {
    const a = getAudio(path);
    a.play().catch((e) => console.warn('[Sound] play failed:', path, e));
  } catch (e) {
    console.warn('[Sound] error:', path, e);
  }
}

export function playJoinSound() { console.log('[Sound] join'); play('/sounds/Entrou.mp3'); }
export function playLeaveSound() { console.log('[Sound] leave'); play('/sounds/Saiu.mp3'); }
export function playScreenStartSound() { console.log('[Sound] screen start'); play('/sounds/Abriu.mp3'); }
export function playScreenStopSound() { console.log('[Sound] screen stop'); play('/sounds/Fechou.mp3'); }
