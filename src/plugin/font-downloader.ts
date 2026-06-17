import { existsSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { extract } from "tar";
import { Readable } from "node:stream";
import type { IRouter } from "express";

const FONTS_DIR = path.join(__dirname, "../public/assets/protomaps/fonts");
const SPRITES_DIR = path.join(__dirname, "../public/assets/protomaps/sprites");
const FONTS_URL =
  "https://github.com/protomaps/basemaps-assets/archive/refs/heads/main.tar.gz";

export function registerAssetEndpoints(router: IRouter) {
  // check if fonts are installed
  router.get(`/fonts-available`, (req, res) => {
    const available =
      existsSync(FONTS_DIR) && readdirSync(FONTS_DIR).length > 0;
    res.status(available ? 200 : 404).json({ available });
  });

  // trigger font download from github
  router.post(`/download-fonts`, async (req, res) => {
    try {
      mkdirSync(FONTS_DIR, { recursive: true });
      mkdirSync(SPRITES_DIR, { recursive: true });

      const response = await fetch(FONTS_URL);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

      if (!response.body) throw new Error("No response body");

      await pipeline(
        Readable.fromWeb(response.body as import("stream/web").ReadableStream),
        extract({
          cwd: path.join(__dirname, "../public/assets/protomaps"),
          strip: 1,
          filter: (filePath) =>
            filePath.includes("/fonts/") || filePath.includes("/sprites/"),
        }),
      );

      res.json({ success: true });
    } catch (err) {
      console.error("Font download failed:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // remove fonts
  router.post(`/remove-fonts`, (req, res) => {
    try {
      if (existsSync(FONTS_DIR)) rmSync(FONTS_DIR, { recursive: true });
      if (existsSync(SPRITES_DIR)) rmSync(SPRITES_DIR, { recursive: true });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // upload font pack tarball
  router.post(`/upload-fonts`, async (req, res) => {
    try {
      mkdirSync(FONTS_DIR, { recursive: true });
      mkdirSync(SPRITES_DIR, { recursive: true });

      await pipeline(
        req,
        extract({
          cwd: path.join(__dirname, "../public/assets/protomaps"),
          strip: 1,
          filter: (filePath) =>
            filePath.includes("/fonts/") || filePath.includes("/sprites/"),
        }),
      );

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}
