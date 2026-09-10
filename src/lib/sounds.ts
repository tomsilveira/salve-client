const sounds = {
  join: new Audio('/sounds/Entrou.mp3'),
  leave: new Audio('/sounds/Saiu.mp3'),
  screenStart: new Audio('/sounds/Abriu.mp3'),
  screenStop: new Audio('/sounds/Fechou.mp3'),
};

function play(sound: HTMLAudioElement) {
  sound.currentTime = 0;
  sound.volume = 0.5;
  sound.play().catch(() => {});
}

export function playJoinSound() { play(sounds.join); }
export function playLeaveSound() { play(sounds.leave); }
export function playScreenStartSound() { play(sounds.screenStart); }
export function playScreenStopSound() { play(sounds.screenStop); }
