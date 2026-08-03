import crypto from "node:crypto";
import fs from "node:fs";

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const PNG_SIGNATURE = "89504e470d0a1a0a";

const [
  glbPath = "assets/models/vendor/wooden-retro-desk.glb",
  baselinePath = "specs/vendor-desk-baseline.json",
] = process.argv.slice(2);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function parseGlb(bytes) {
  expect(bytes.readUInt32LE(0) === GLB_MAGIC, "Input is not a GLB file");
  expect(bytes.readUInt32LE(4) === 2, "Only GLB version 2 is supported");
  expect(bytes.readUInt32LE(8) === bytes.length, "GLB header length is invalid");
  const jsonLength = bytes.readUInt32LE(12);
  expect(bytes.readUInt32LE(16) === JSON_CHUNK, "GLB JSON chunk is missing");
  const jsonEnd = 20 + jsonLength;
  const binLength = bytes.readUInt32LE(jsonEnd);
  expect(bytes.readUInt32LE(jsonEnd + 4) === BIN_CHUNK, "GLB BIN chunk is missing");
  return {
    json: JSON.parse(bytes.subarray(20, jsonEnd).toString("utf8").trim()),
    bin: bytes.subarray(jsonEnd + 8, jsonEnd + 8 + binLength),
  };
}

function dimensions(bytes) {
  expect(bytes.subarray(0, 8).toString("hex") === PNG_SIGNATURE, "Embedded image is not PNG");
  return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const glbBytes = fs.readFileSync(glbPath);
const {json, bin} = parseGlb(glbBytes);

for (const [section, expectedHash] of Object.entries(baseline.structuralHashes)) {
  const actualHash = sha256(JSON.stringify(json[section] ?? null));
  expect(actualHash === expectedHash, `${section} structure differs from the licensed source asset`);
}

for (const expectedView of baseline.binaryViewHashes) {
  const view = json.bufferViews[expectedView.index];
  expect(view?.name === expectedView.name, `Buffer view ${expectedView.index} name changed`);
  expect(view.byteLength === expectedView.byteLength, `Buffer view ${expectedView.index} length changed`);
  const bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  expect(
    sha256(bytes) === expectedView.sha256,
    `Buffer view ${expectedView.index} binary data changed`,
  );
}

expect(json.images?.length === baseline.imageNames.length, "Desk texture count changed");
const textures = json.images.map((image, index) => {
  expect(image.mimeType === "image/png", `Texture ${index} is not PNG`);
  const view = json.bufferViews[image.bufferView];
  expect(view.name === baseline.imageNames[index], `Texture ${index} name changed`);
  const bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  const size = dimensions(bytes);
  expect(
    Math.max(size.width, size.height) <= baseline.maxTextureDimension,
    `${view.name} exceeds ${baseline.maxTextureDimension}px`,
  );
  return {name: view.name, ...size, bytes: view.byteLength};
});

expect(glbBytes.length < baseline.maxOptimizedBytes, "Optimized desk GLB exceeds size budget");
console.log(`VENDOR_DESK_GLTF_OK ${JSON.stringify({
  glb: glbPath,
  bytes: glbBytes.length,
  nodes: json.nodes.length,
  meshes: json.meshes.length,
  skins: json.skins.length,
  animations: json.animations.length,
  animationChannels: json.animations.reduce((sum, animation) => sum + animation.channels.length, 0),
  textures,
})}`);
