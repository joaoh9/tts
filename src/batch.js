import fs from "node:fs/promises";
import path from "node:path";
import { isWorkbenchSidecar, normalizeText } from "./text.js";

export async function listBatchFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".txt")) continue;
    const filePath = path.join(dir, entry.name);
    const text = await fs.readFile(filePath, "utf8");
    if (isWorkbenchSidecar(text)) continue;
    files.push({
      name: entry.name,
      path: filePath,
      text: normalizeText(text),
    });
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  return files;
}

export async function runBatch({
  inputDir,
  outputDir,
  voiceName,
  catalog,
  synthesize,
  onItem,
}) {
  const files = await listBatchFiles(inputDir);
  if (files.length === 0) {
    throw new Error(`No .txt files found in ${inputDir}`);
  }
  const results = [];
  for (const file of files) {
    if (!file.text) {
      const skipped = { file: file.name, skipped: true, reason: "empty" };
      onItem?.(skipped);
      results.push(skipped);
      continue;
    }
    const take = await synthesize({
      text: file.text,
      voiceName,
      catalog,
      extraDir: outputDir,
    });
    const item = {
      file: file.name,
      slug: take.slug,
      mp3Path: take.copyPath || take.mp3Path,
      libraryPath: take.mp3Path,
    };
    onItem?.(item);
    results.push(item);
  }
  return results;
}
