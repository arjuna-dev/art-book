import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const layoutJsonPath = path.resolve(__dirname, "../art-book-layout.json");

function artBookLayoutWriter() {
  return {
    name: "art-book-layout-writer",
    configureServer(server) {
      server.middlewares.use("/__art-book-layout__", async (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }

        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));

          const isValidPayload =
            (payload?.version === 1 && typeof payload.artworks === "object") ||
            (payload?.version === 2 && Array.isArray(payload.pages));

          if (!isValidPayload) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: "Invalid layout payload" }));
            return;
          }

          const nextContent = `${JSON.stringify(payload, null, 2)}\n`;
          const currentContent = await fs
            .readFile(layoutJsonPath, "utf8")
            .catch(() => "");

          if (currentContent !== nextContent) {
            await fs.writeFile(layoutJsonPath, nextContent);
          }

          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          server.config.logger.error(error);
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: "Could not save layout" }));
        }
      });
    },
    handleHotUpdate({ file }) {
      if (path.resolve(file) === layoutJsonPath) return [];
    },
  };
}

export default defineConfig({
  base: process.env.BASE_URL ?? "/",
  plugins: [vue(), artBookLayoutWriter()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    fs: {
      allow: [".."],
    },
  },
});
