import fs from "node:fs";
import path from "node:path";
import express from "express";
import { diagnoseAll } from "./engines/index.js";
import { listTakes, resolveTakeFile } from "./library.js";
import { libraryRoot, publicDir } from "./paths.js";
import { synthesizeTake } from "./synthesize.js";
import { estimateSeconds, wordCount } from "./text.js";
import { groupVoices, loadVoices } from "./voices.js";
import { bindHost, bindPort } from "./config.js";

export function createApp({
  catalog = loadVoices(),
  root = libraryRoot(),
  synthesize = synthesizeTake,
  diagnose = diagnoseAll,
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));
  app.use(express.static(publicDir()));

  app.get("/api/voices", (_req, res) => {
    res.json({
      default: catalog.default,
      groups: groupVoices(catalog.voices),
    });
  });

  app.get("/api/status", async (_req, res, next) => {
    try {
      const engines = await diagnose();
      res.json({
        host: bindHost(),
        library: root,
        engines,
      });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/takes", async (_req, res, next) => {
    try {
      res.json({ takes: await listTakes({ root }) });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/takes/:day/:file", (req, res, next) => {
    try {
      const filePath = resolveTakeFile(root, req.params.day, req.params.file);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: "Take not found" });
        return;
      }
      res.setHeader("Content-Type", "audio/mpeg");
      res.sendFile(path.resolve(filePath));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/speak", async (req, res, next) => {
    try {
      const text = req.body?.text;
      const voiceName = req.body?.voice;
      const take = await synthesize({
        text,
        voiceName,
        catalog,
        root,
      });
      res.json({
        slug: take.slug,
        day: take.day,
        engine: take.engine,
        voice: take.voice.name,
        words: wordCount(text),
        estimateSeconds: estimateSeconds(text),
        path: take.mp3Path,
        url: `/api/takes/${take.day}/${encodeURIComponent(take.slug)}.mp3`,
      });
    } catch (err) {
      next(err);
    }
  });

  app.use((err, _req, res, _next) => {
    const status = /not found|unknown|paste or pass|nothing to speak|invalid/i.test(
      err.message,
    )
      ? 400
      : 500;
    res.status(status).json({ error: err.message || "Server error" });
  });

  return app;
}

export function startServer({
  host = bindHost(),
  port = bindPort(),
  app = createApp(),
} = {}) {
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("This booth only binds to localhost.");
  }
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.on("error", reject);
  });
}
