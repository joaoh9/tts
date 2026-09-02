import { Deck, SKIP_SECONDS, formatRate, formatTimestamp } from "./playback.js";

const textEl = document.querySelector("#text");
const metaEl = document.querySelector("#script-meta");
const voicesEl = document.querySelector("#voices");
const recordEl = document.querySelector("#record");
const statusEl = document.querySelector("#status");
const takesEl = document.querySelector("#takes");
const playerEl = document.querySelector("#player");
const titleEl = document.querySelector("#player-title");
const subEl = document.querySelector("#player-sub");
const currentEl = document.querySelector("#player-current");
const durationEl = document.querySelector("#player-duration");
const seekEl = document.querySelector("#player-seek");
const backEl = document.querySelector("#player-back");
const fwdEl = document.querySelector("#player-fwd");
const toggleEl = document.querySelector("#player-toggle");
const rateEl = document.querySelector("#player-rate");

const deck = new Deck(new Audio());
let selectedVoice = null;
let engines = {};
let takes = [];
let seeking = false;
let logKey = "";

function wordCount(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function estimateSeconds(words) {
  return Math.max(1, Math.round((words / 150) * 60));
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function updateMeta() {
  const words = wordCount(textEl.value);
  if (!words) {
    metaEl.textContent = "0 words";
    return;
  }
  metaEl.textContent = `${words} words · ~${estimateSeconds(words)}s`;
}

function renderVoices(payload) {
  voicesEl.replaceChildren();
  selectedVoice = payload.default;
  for (const group of payload.groups) {
    const section = document.createElement("section");
    section.className = "group";
    const heading = document.createElement("h3");
    heading.textContent = group.label;
    const pills = document.createElement("div");
    pills.className = "pills";
    const engineState = engines[group.engine];
    const available = engineState ? engineState.available : group.engine === "kokoro";
    for (const voice of group.voices) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pill";
      button.dataset.name = voice.name;
      button.disabled = !available;
      button.setAttribute("aria-pressed", String(voice.name === selectedVoice));
      button.append(voice.name);
      if (group.privacy === "hosted") {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = "net";
        button.append(tag);
      }
      button.title = available
        ? `${voice.engine} · ${voice.voice}`
        : engineState?.detail || "Engine unavailable";
      button.addEventListener("click", () => selectVoice(voice.name));
      pills.append(button);
    }
    section.append(heading, pills);
    voicesEl.append(section);
  }
}

function selectVoice(name) {
  selectedVoice = name;
  for (const button of voicesEl.querySelectorAll(".pill")) {
    button.setAttribute("aria-pressed", String(button.dataset.name === name));
  }
}

function cueTake(take) {
  if (deck.isCurrent(take)) {
    deck.toggle();
    return;
  }
  deck.load(take, { autoplay: true });
}

function renderTakes(list) {
  takes = list;
  takesEl.replaceChildren();
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No takes yet. Record one and it shows up here.";
    takesEl.append(empty);
    return;
  }
  const snap = deck.snapshot();
  for (const take of list) {
    const item = document.createElement("li");
    const current = snap.take && snap.take.url === take.url;
    if (current) item.classList.add("current");
    const id = document.createElement("span");
    id.className = "take-id";
    id.textContent = take.slug;
    const copy = document.createElement("span");
    copy.className = "take-copy";
    copy.textContent = [take.voice, take.preview].filter(Boolean).join(" — ");
    const play = document.createElement("button");
    play.type = "button";
    play.textContent = current && !snap.paused ? "Pause" : "Play";
    play.setAttribute("aria-label", `${play.textContent} ${take.slug}`);
    play.addEventListener("click", () => cueTake(take));
    item.append(id, copy, play);
    takesEl.append(item);
  }
}

function renderPlayer(snap) {
  const loaded = Boolean(snap.take);
  playerEl.classList.toggle("empty", !loaded);
  titleEl.textContent = loaded ? snap.take.slug : "No take loaded";
  subEl.textContent = loaded
    ? [snap.take.voice, snap.take.preview].filter(Boolean).join(" — ") || snap.take.url
    : "Record a take or cue one from the tape log.";
  currentEl.textContent = formatTimestamp(snap.current);
  durationEl.textContent = formatTimestamp(snap.duration);
  if (!seeking) {
    seekEl.max = snap.duration > 0 ? String(snap.duration) : "0";
    seekEl.value = String(snap.current || 0);
  }
  const elapsed = Number(seekEl.value) || 0;
  const pct = snap.duration > 0 ? (elapsed / snap.duration) * 100 : 0;
  seekEl.style.background = `linear-gradient(to right, var(--accent) ${pct}%, var(--line) ${pct}%)`;
  seekEl.setAttribute(
    "aria-valuetext",
    `${formatTimestamp(elapsed)} of ${formatTimestamp(snap.duration)}`,
  );
  seekEl.disabled = !loaded;
  backEl.disabled = !loaded;
  fwdEl.disabled = !loaded;
  toggleEl.disabled = !loaded;
  rateEl.disabled = !loaded;
  toggleEl.textContent = loaded && !snap.paused ? "Pause" : "Play";
  rateEl.textContent = formatRate(snap.rate);
  const nextLogKey = `${snap.take?.url || ""}:${snap.paused}`;
  if (nextLogKey !== logKey) {
    logKey = nextLogKey;
    if (takes.length) renderTakes(takes);
  }
}

function typingTarget(target) {
  if (!target || !target.closest) return false;
  return Boolean(target.closest("textarea, input, select, button, [contenteditable='true']"));
}

async function load() {
  const [statusRes, voicesRes, takesRes] = await Promise.all([
    fetch("/api/status"),
    fetch("/api/voices"),
    fetch("/api/takes"),
  ]);
  const status = await statusRes.json();
  const voices = await voicesRes.json();
  const tape = await takesRes.json();
  engines = status.engines || {};
  renderVoices(voices);
  renderTakes(tape.takes || []);
  const missing = Object.values(engines)
    .filter((engine) => !engine.available)
    .map((engine) => engine.engine);
  if (missing.length) {
    setStatus(`Idle. Unavailable: ${missing.join(", ")}.`);
  } else {
    setStatus("Idle. Local engines ready.");
  }
}

async function record() {
  const text = textEl.value.trim();
  if (!text) {
    setStatus("Paste a script first.", true);
    textEl.focus();
    return;
  }
  recordEl.disabled = true;
  document.body.classList.add("recording");
  setStatus("Recording take…");
  try {
    const response = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: selectedVoice }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Speak failed");
    setStatus(`${payload.slug}.mp3 · ${payload.engine}/${payload.voice}`);
    const tape = await fetch("/api/takes").then((res) => res.json());
    const list = tape.takes || [];
    renderTakes(list);
    const take = list.find((item) => item.url === payload.url) || {
      slug: payload.slug,
      url: payload.url,
      voice: payload.voice,
      preview: text.slice(0, 140),
    };
    await deck.load(take, { autoplay: true });
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    recordEl.disabled = false;
    document.body.classList.remove("recording");
  }
}

deck.on(renderPlayer);
renderPlayer(deck.snapshot());

backEl.addEventListener("click", () => deck.skip(-SKIP_SECONDS));
fwdEl.addEventListener("click", () => deck.skip(SKIP_SECONDS));
toggleEl.addEventListener("click", () => deck.toggle());
rateEl.addEventListener("click", () => deck.cycleRate());
seekEl.addEventListener("pointerdown", () => {
  seeking = true;
});
seekEl.addEventListener("input", () => {
  seeking = true;
  const elapsed = Number(seekEl.value) || 0;
  const duration = Number(seekEl.max) || 0;
  currentEl.textContent = formatTimestamp(elapsed);
  const pct = duration > 0 ? (elapsed / duration) * 100 : 0;
  seekEl.style.background = `linear-gradient(to right, var(--accent) ${pct}%, var(--line) ${pct}%)`;
});
seekEl.addEventListener("change", () => {
  deck.seek(Number(seekEl.value));
  seeking = false;
});
seekEl.addEventListener("pointerup", () => {
  seeking = false;
});

textEl.addEventListener("input", () => {
  updateMeta();
  if (statusEl.classList.contains("error")) setStatus("");
});
recordEl.addEventListener("click", record);
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    record();
    return;
  }
  if (typingTarget(event.target)) return;
  if (event.code === "Space") {
    event.preventDefault();
    deck.toggle();
  } else if (event.code === "ArrowLeft") {
    event.preventDefault();
    deck.skip(-SKIP_SECONDS);
  } else if (event.code === "ArrowRight") {
    event.preventDefault();
    deck.skip(SKIP_SECONDS);
  }
});

updateMeta();
load().catch((err) => setStatus(err.message, true));
