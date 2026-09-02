function findChunk(buffer, id) {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const name = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (name === id) {
      return { offset: offset + 8, size };
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

export function encodeWav(samples, sampleRate) {
  const pcm = floatTo16BitPcm(samples);
  const header = Buffer.alloc(44);
  const dataSize = pcm.length;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

export function decodeWav(buffer) {
  if (buffer.length < 44) {
    throw new Error("WAV is too short");
  }
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a RIFF/WAVE file");
  }
  const fmt = findChunk(buffer, "fmt ");
  const data = findChunk(buffer, "data");
  if (!fmt || !data) {
    throw new Error("WAV is missing fmt or data chunk");
  }
  const audioFormat = buffer.readUInt16LE(fmt.offset);
  const channels = buffer.readUInt16LE(fmt.offset + 2);
  const sampleRate = buffer.readUInt32LE(fmt.offset + 4);
  const bits = buffer.readUInt16LE(fmt.offset + 14);
  if (audioFormat !== 1) {
    throw new Error(`Unsupported WAV format ${audioFormat} (PCM required)`);
  }
  if (channels !== 1) {
    throw new Error(`Unsupported channel count ${channels} (mono required)`);
  }
  if (bits !== 16) {
    throw new Error(`Unsupported bit depth ${bits} (16-bit required)`);
  }
  const pcm = buffer.subarray(data.offset, data.offset + data.size);
  const samples = new Float32Array(Math.floor(pcm.length / 2));
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = pcm.readInt16LE(i * 2) / 0x8000;
  }
  return { samples, sampleRate };
}

export function concatPcm(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function silence(sampleRate, seconds = 0.18) {
  return new Float32Array(Math.max(0, Math.round(sampleRate * seconds)));
}

function floatTo16BitPcm(samples) {
  const buf = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    let s = samples[i];
    if (s > 1) s = 1;
    if (s < -1) s = -1;
    buf.writeInt16LE(s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), i * 2);
  }
  return buf;
}

export function pcmFromTyped(data) {
  if (data instanceof Float32Array) return data;
  return Float32Array.from(data);
}
