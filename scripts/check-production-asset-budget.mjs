import fs from "node:fs";
import path from "node:path";

const DIST_DIRECTORY = path.resolve("dist");
const MAX_DIST_BYTES = 55 * 1024 * 1024;
const MAX_SINGLE_ASSET_BYTES = 15 * 1024 * 1024;
const MAX_INITIAL_MODEL_BYTES = 25 * 1024 * 1024;
const INITIAL_MODEL_PATHS = [
  "models/typewriter-interactive.glb",
  "models/vendor/wooden-retro-desk.glb",
];

function filesBelow(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(absolutePath) : [absolutePath];
  });
}

if (!fs.existsSync(DIST_DIRECTORY)) {
  throw new Error("dist is missing; run npm run build before checking the asset budget");
}

const files = filesBelow(DIST_DIRECTORY);
const totalBytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const oversized = files
  .map((file) => ({
    file: path.relative(DIST_DIRECTORY, file),
    bytes: fs.statSync(file).size,
  }))
  .filter(({bytes}) => bytes > MAX_SINGLE_ASSET_BYTES);
const initialModelBytes = INITIAL_MODEL_PATHS.reduce((sum, relativePath) => {
  const file = path.join(DIST_DIRECTORY, relativePath);
  if (!fs.existsSync(file)) throw new Error(`required initial model is missing: ${relativePath}`);
  return sum + fs.statSync(file).size;
}, 0);

const formatMiB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
console.log(`Production output: ${formatMiB(totalBytes)}`);
console.log(`Initial model set: ${formatMiB(initialModelBytes)}`);

if (totalBytes > MAX_DIST_BYTES) {
  throw new Error(`dist exceeds ${formatMiB(MAX_DIST_BYTES)}`);
}
if (initialModelBytes > MAX_INITIAL_MODEL_BYTES) {
  throw new Error(`initial model set exceeds ${formatMiB(MAX_INITIAL_MODEL_BYTES)}`);
}
if (oversized.length > 0) {
  throw new Error(
    `individual assets exceed ${formatMiB(MAX_SINGLE_ASSET_BYTES)}: ${
      oversized.map(({file, bytes}) => `${file} (${formatMiB(bytes)})`).join(", ")
    }`,
  );
}
