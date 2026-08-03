import {defineConfig} from "vite";
import fs from "node:fs";
import path from "node:path";

export default defineConfig({
  publicDir: "assets",
  plugins: [
    {
      name: "emit-current-typewriter-assets",
      apply: "build",
      buildStart() {
        for (const fileName of [
          "typeworld-mark.svg",
          "site.webmanifest",
          "typeworld-social-preview-v1.jpg",
        ]) {
          this.emitFile({
            type: "asset",
            fileName: `brand/${fileName}`,
            source: fs.readFileSync(path.resolve(`assets/brand/${fileName}`)),
          });
        }
        this.emitFile({
          type: "asset",
          fileName: "models/typewriter-interactive.glb",
          source: fs.readFileSync(path.resolve("assets/models/typewriter-interactive.glb")),
        });
        this.emitFile({
          type: "asset",
          fileName: "models/typewriter-environment.glb",
          source: fs.readFileSync(path.resolve("assets/models/typewriter-environment.glb")),
        });
        this.emitFile({
          type: "asset",
          fileName: "models/vendor/wooden-retro-desk.glb",
          source: fs.readFileSync(path.resolve("assets/models/vendor/wooden-retro-desk.glb")),
        });
        for (const fileName of [
          "Shelf_01_1k.gltf",
          "Shelf_01.bin",
          "textures/Shelf_01_diff_1k.jpg",
          "textures/Shelf_01_nor_gl_1k.jpg",
          "textures/Shelf_01_arm_1k.jpg",
        ]) {
          this.emitFile({
            type: "asset",
            fileName: `models/vendor/poly-haven-shelf-01/${fileName}`,
            source: fs.readFileSync(
              path.resolve(`assets/models/vendor/poly-haven-shelf-01/${fileName}`),
            ),
          });
        }
        for (const fileName of [
          "flower_ursinia_1k.gltf",
          "flower_ursinia.bin",
          "textures/flower_ursinia_diff_1k.jpg",
          "textures/flower_ursinia_nor_gl_1k.jpg",
          "textures/flower_ursinia_arm_1k.jpg",
          "textures/flower_ursinia_alpha_1k.png",
        ]) {
          this.emitFile({
            type: "asset",
            fileName: `models/vendor/poly-haven-flower-ursinia/${fileName}`,
            source: fs.readFileSync(
              path.resolve(`assets/models/vendor/poly-haven-flower-ursinia/${fileName}`),
            ),
          });
        }
        for (const fileName of ["key.mp3", "space.mp3", "return.mp3", "bell.mp3"]) {
          this.emitFile({
            type: "asset",
            fileName: `audio/typewriter/${fileName}`,
            source: fs.readFileSync(path.resolve(`assets/audio/typewriter/${fileName}`)),
          });
        }
        for (const fileName of [
          "chopin-nocturne-op9-no2.mp3",
          "bach-prelude-bwv847.mp3",
          "beethoven-pathetique-adagio.mp3",
          "beethoven-minuet-g.mp3",
          "bach-goldberg-aria.mp3",
          "chopin-waltz-a-minor-b150.mp3",
        ]) {
          this.emitFile({
            type: "asset",
            fileName: `audio/music/${fileName}`,
            source: fs.readFileSync(path.resolve(`assets/audio/music/${fileName}`)),
          });
        }
        this.emitFile({
          type: "asset",
          fileName: "audio/paper/page-turn.mp3",
          source: fs.readFileSync(path.resolve("assets/audio/paper/page-turn.mp3")),
        });
        this.emitFile({
          type: "asset",
          fileName: "audio/fire/burning-paper.mp3",
          source: fs.readFileSync(path.resolve("assets/audio/fire/burning-paper.mp3")),
        });
        for (const [folder, files] of [
          ["leafset029", ["color.jpg", "normal-gl.jpg", "roughness.jpg", "opacity.jpg"]],
          ["bark014", ["color.jpg", "normal-gl.jpg", "roughness.jpg"]],
        ] as const) {
          for (const fileName of files) {
            this.emitFile({
              type: "asset",
              fileName: `textures/green/${folder}/${fileName}`,
              source: fs.readFileSync(
                path.resolve(`assets/textures/green/${folder}/${fileName}`),
              ),
            });
          }
        }
        this.emitFile({
          type: "asset",
          fileName: "textures/ui/pet-archive-seal-runtime-v2.png",
          source: fs.readFileSync(
            path.resolve("assets/textures/ui/pet-archive-seal-runtime-v2.png"),
          ),
        });
        for (const fileName of [
          "typewriter-study-runtime.jpg",
          "word-record-runtime-v1.jpg",
        ]) {
          this.emitFile({
            type: "asset",
            fileName: `textures/room/${fileName}`,
            source: fs.readFileSync(path.resolve(`assets/textures/room/${fileName}`)),
          });
        }
        this.emitFile({
          type: "asset",
          fileName: "textures/projects/typeworld-volume-01-cover-base-v1.jpg",
          source: fs.readFileSync(
            path.resolve("assets/textures/projects/typeworld-volume-01-cover-base-v1.jpg"),
          ),
        });
        for (const volume of ["02", "03", "04"]) {
          this.emitFile({
            type: "asset",
            fileName: `textures/projects/typeworld-volume-${volume}-cover-base-v1.jpg`,
            source: fs.readFileSync(
              path.resolve(
                `assets/textures/projects/typeworld-volume-${volume}-cover-base-v1.jpg`,
              ),
            ),
          });
        }
      },
    },
  ],
  build: {
    copyPublicDir: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main: path.resolve("index.html"),
        bookSample: path.resolve("book-sample.html"),
        booksSample: path.resolve("books-sample.html"),
        bookDetailSample: path.resolve("book-detail-sample.html"),
        projects: path.resolve("projects.html"),
        project: path.resolve("project.html"),
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4174,
  },
});
