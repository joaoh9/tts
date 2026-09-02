export const SKIP_SECONDS = 15;
export const SPEEDS = [0.8, 1, 1.2, 1.5, 2];

export function formatTimestamp(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const padded = String(secs).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${padded}`;
  }
  return `${minutes}:${padded}`;
}

export function clampTime({ current, delta = 0, duration }) {
  const next = (Number.isFinite(current) ? current : 0) + delta;
  const start = Math.max(0, next);
  if (!Number.isFinite(duration) || duration <= 0) return start;
  return Math.min(duration, start);
}

export function nextSpeed(current, speeds = SPEEDS) {
  const index = speeds.indexOf(current);
  if (index === -1) return 1;
  return speeds[(index + 1) % speeds.length];
}

export function formatRate(rate) {
  if (rate === 1) return "1×";
  return `${rate}×`;
}

export class Deck {
  constructor(audio) {
    this.audio = audio;
    this.take = null;
    this.listeners = new Set();
    for (const event of ["timeupdate", "loadedmetadata", "durationchange", "play", "pause", "ended", "error"]) {
      audio.addEventListener(event, () => this.emit());
    }
  }

  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    const snap = this.snapshot();
    for (const listener of this.listeners) listener(snap);
  }

  snapshot() {
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    return {
      take: this.take,
      current: this.audio.currentTime || 0,
      duration,
      paused: this.audio.paused,
      ended: this.audio.ended === true,
      rate: this.audio.playbackRate || 1,
      src: this.audio.src || "",
    };
  }

  load(take, { autoplay = true } = {}) {
    this.take = take;
    this.audio.src = take.url;
    this.audio.playbackRate = this.audio.playbackRate || 1;
    this.emit();
    if (autoplay) return this.play();
    return Promise.resolve();
  }

  play() {
    const playing = this.audio.play();
    return playing && typeof playing.catch === "function"
      ? playing.catch(() => {})
      : Promise.resolve();
  }

  pause() {
    this.audio.pause();
  }

  toggle() {
    if (!this.take) return Promise.resolve();
    if (this.audio.paused) return this.play();
    this.pause();
    return Promise.resolve();
  }

  skip(delta) {
    if (!this.take) return;
    this.audio.currentTime = clampTime({
      current: this.audio.currentTime,
      delta,
      duration: this.audio.duration,
    });
    this.emit();
  }

  seek(time) {
    if (!this.take) return;
    this.audio.currentTime = clampTime({
      current: time,
      duration: this.audio.duration,
    });
    this.emit();
  }

  cycleRate() {
    this.audio.playbackRate = nextSpeed(this.audio.playbackRate || 1);
    this.emit();
    return this.audio.playbackRate;
  }

  isCurrent(take) {
    return Boolean(this.take && take && this.take.url === take.url);
  }
}
