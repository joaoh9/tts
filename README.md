# TTS Workbench

A personal, local-first text-to-speech booth: paste text, pick a voice preset, get an mp3. Node CLI plus a localhost page. No accounts. No telemetry. The only network calls after setup are the optional hosted API.

This is the DIY slice of a product like ElevenLabs — the part that is actually yours to run. Voice cloning, dubbing, and emotional direction are out of scope on purpose. **Never clone a real person's voice.** That is the part that should not be DIY.

## The quality gap is real

Kokoro (82M, Apache) and Piper (ONNX VITS) are the best fully local, CPU-friendly voices you can run without a lab. They are good enough to narrate notes, proofread prose by ear, and archive articles. They are **not** ElevenLabs.

Frontier voice models plus the licensing that lets a company ship them are the product. You cannot rebuild that stack solo, and this workbench does not pretend otherwise. When a take has to sound closer to commercial speech, point `OPENAI_API_KEY` at OpenAI's stock TTS voices (`tts-1-hd`). That path leaves your machine. Local remains the default.

## Setup

Needs Node 20+ and ffmpeg (for Kokoro/Piper → mp3). OpenAI already returns mp3.

```bash
git clone <this-repo>
cd text-to-speech
npm install
cp .env.example .env
brew install ffmpeg   # macOS; skip if ffmpeg is already on PATH
```

`ffmpeg-static` is also a dependency, so mp3 encoding works even without a system binary.

### Engine 1 — Kokoro (default, local CPU)

No separate model download step. The first `tts speak` (or the first Record take in the booth) pulls `onnx-community/Kokoro-82M-v1.0-ONNX` from Hugging Face into `~/.cache/tts-workbench/kokoro` (override with `TTS_CACHE_DIR`). After that it stays on disk.

```bash
node bin/tts.js speak "The booth is live." --voice heart
```

Expect a pause on first run. Later takes are local.

Optional env:

- `KOKORO_DTYPE=q8` (default) · `fp32` if you want more precision
- `KOKORO_DEVICE=cpu` (falls back to `wasm` if CPU ONNX fails)

### Engine 1b — Piper (local CPU, optional)

Piper is a separate binary plus `.onnx` voices. It is faster and smaller than Kokoro; the timbre is more “classic neural TTS.”

```bash
python3 -m pip install --user piper-tts
# or: brew install piper-tts   (if available)

# tell the workbench how to invoke it, if the binary is not named `piper`
# echo 'PIPER_BIN=piper' >> .env
# echo 'PIPER_BIN=python3 -m piper' >> .env

node bin/tts.js setup piper
# downloads en_US-lessac-medium and en_US-amy-medium into
# ~/.cache/tts-workbench/piper

node bin/tts.js speak "Piper is online." --voice lessac
```

Custom voice (still a public Piper model, not a clone):

```bash
node bin/tts.js setup piper en_GB-alba-medium
```

Add a matching entry to `voices.json`.

### Engine 2 — OpenAI TTS (optional hosted fallback)

Put a key in `.env`:

```
OPENAI_API_KEY=sk-...
OPENAI_TTS_MODEL=tts-1-hd
```

Presets `alloy`, `nova`, and `onyx` in `voices.json` use this engine. No key → those pills stay disabled. This workbench does not send `instructions` and does not call any cloning endpoint.

## Usage

```bash
node bin/tts.js speak "Hello from the booth" --voice heart
node bin/tts.js speak --file article.txt --voice bella
echo "stdin works" | node bin/tts.js speak --voice heart

node bin/tts.js batch ./notes --voice heart --out ./notes-mp3
node bin/tts.js serve          # http://127.0.0.1:3333  (localhost only)
node bin/tts.js voices
node bin/tts.js doctor
```

Install the `tts` bin on your PATH with `npm link` if you want the short command.

### Library

Every generation is archived:

```
~/TTS/YYYY-MM-DD/<slug>.mp3
~/TTS/YYYY-MM-DD/<slug>.txt
```

The sidecar holds the input text plus `engine`, `voice`, `voice_id`, and `speed`. Override the root with `TTS_LIBRARY_DIR`.

`--out` copies the mp3 somewhere else as well (batch defaults to the input folder).

### Voice presets

`voices.json`:

```json
{
  "name": "heart",
  "engine": "kokoro",
  "voice": "af_heart",
  "speed": 1
}
```

`engine` is `kokoro`, `piper`, or `openai`. `voice` is the engine's stock id — Kokoro's `af_heart`, Piper's `en_US-lessac-medium`, OpenAI's `alloy`. There is no slot for a reference clip, a speaker embedding, or a cloned id.

### Batch

Point it at a folder of `.txt` files and get mp3s. Sidecar files from this workbench (`# tts-workbench take`) are skipped, so you can batch a notes directory without re-narrating the archive.

## Local web booth

```bash
node bin/tts.js serve
```

Binds **127.0.0.1 only**. Paste a script, pick a rack voice, record a take, play it back. Hosted voices are marked `NET`.

## What this is not

- Not voice cloning, not instant voice cloning, not a fine-tune of a real speaker
- Not dubbing or lip-sync
- Not emotional voice direction / SSML performance coaching
- Not a hosted service, not an account, not ElevenLabs

If you need those, you are shopping for a company with models, data, and licenses — not a weekend binary.

## License

MIT for this workbench's code. Kokoro weights are Apache-2.0 (Hexgrad / onnx-community). Piper voices follow their upstream terms on [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices). OpenAI usage follows OpenAI's terms and billing.
