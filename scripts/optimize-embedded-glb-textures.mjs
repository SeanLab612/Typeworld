import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const PNG_SIGNATURE = "89504e470d0a1a0a";

const [inputPath, outputPath, maxDimensionArg = "768"] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: optimize-embedded-glb-textures.mjs <input.glb> <output.glb> [max-dimension]");
}
const maxDimension = Number.parseInt(maxDimensionArg, 10);
if (!Number.isInteger(maxDimension) || maxDimension < 256) {
  throw new Error(`Invalid maximum texture dimension: ${maxDimensionArg}`);
}

const align4 = (value) => (value + 3) & ~3;

function parseGlb(bytes) {
  if (bytes.readUInt32LE(0) !== GLB_MAGIC) throw new Error("Input is not a GLB file");
  if (bytes.readUInt32LE(4) !== 2) throw new Error("Only GLB version 2 is supported");
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error("GLB header length is invalid");
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== JSON_CHUNK) throw new Error("GLB JSON chunk is missing");
  const jsonStart = 20;
  const jsonEnd = jsonStart + jsonLength;
  const binLength = bytes.readUInt32LE(jsonEnd);
  if (bytes.readUInt32LE(jsonEnd + 4) !== BIN_CHUNK) throw new Error("GLB BIN chunk is missing");
  return {
    json: JSON.parse(bytes.subarray(jsonStart, jsonEnd).toString("utf8").trim()),
    bin: bytes.subarray(jsonEnd + 8, jsonEnd + 8 + binLength),
  };
}

function pngDimensions(bytes) {
  if (bytes.subarray(0, 8).toString("hex") !== PNG_SIGNATURE) {
    throw new Error("Only embedded PNG textures are supported");
  }
  return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
}

function encodeGlb(json, logicalBin) {
  const jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPadded = Buffer.alloc(align4(jsonBytes.length), 0x20);
  jsonBytes.copy(jsonPadded);
  const binPadded = Buffer.alloc(align4(logicalBin.length));
  logicalBin.copy(binPadded);
  const totalLength = 12 + 8 + jsonPadded.length + 8 + binPadded.length;
  const output = Buffer.alloc(totalLength);
  output.writeUInt32LE(GLB_MAGIC, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(jsonPadded.length, 12);
  output.writeUInt32LE(JSON_CHUNK, 16);
  jsonPadded.copy(output, 20);
  const binHeader = 20 + jsonPadded.length;
  output.writeUInt32LE(binPadded.length, binHeader);
  output.writeUInt32LE(BIN_CHUNK, binHeader + 4);
  binPadded.copy(output, binHeader + 8);
  return output;
}

const sourceBytes = fs.readFileSync(inputPath);
const {json, bin} = parseGlb(sourceBytes);
const imageEntries = (json.images ?? []).map((image, imageIndex) => {
  if (image.mimeType !== "image/png" || !Number.isInteger(image.bufferView)) {
    throw new Error(`Texture ${imageIndex} is not an embedded PNG`);
  }
  return {imageIndex, viewIndex: image.bufferView, view: json.bufferViews[image.bufferView]};
}).sort((a, b) => (a.view.byteOffset ?? 0) - (b.view.byteOffset ?? 0));

if (imageEntries.length === 0) throw new Error("GLB has no embedded PNG textures");
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "glb-textures-"));
const report = [];

try {
  const optimizedImages = new Map();
  for (const entry of imageEntries) {
    const sourceOffset = entry.view.byteOffset ?? 0;
    const sourceImage = Buffer.from(
      bin.subarray(sourceOffset, sourceOffset + entry.view.byteLength),
    );
    const before = pngDimensions(sourceImage);
    let optimizedImage = sourceImage;
    if (Math.max(before.width, before.height) > maxDimension) {
      const inputImagePath = path.join(temporaryDirectory, `texture-${entry.imageIndex}-input.png`);
      const outputImagePath = path.join(temporaryDirectory, `texture-${entry.imageIndex}-output.png`);
      fs.writeFileSync(inputImagePath, sourceImage);
      execFileSync(
        "/usr/bin/sips",
        ["--resampleHeightWidthMax", String(maxDimension), inputImagePath, "--out", outputImagePath],
        {stdio: "pipe"},
      );
      const resizedImage = fs.readFileSync(outputImagePath);
      // PNG filters can make a smaller raster larger for flat color or packed
      // roughness maps. Keep the source bytes unless resampling is a real win.
      if (resizedImage.length < sourceImage.length) optimizedImage = resizedImage;
    }
    optimizedImages.set(entry.viewIndex, optimizedImage);
    report.push({
      imageIndex: entry.imageIndex,
      before,
      after: pngDimensions(optimizedImage),
      beforeBytes: sourceImage.length,
      afterBytes: optimizedImage.length,
    });
  }

  const chunks = [];
  let logicalLength = 0;
  const orderedViews = json.bufferViews
    .map((view, viewIndex) => ({view, viewIndex}))
    .sort((a, b) => (a.view.byteOffset ?? 0) - (b.view.byteOffset ?? 0));
  let previousSourceEnd = 0;
  for (const {view, viewIndex} of orderedViews) {
    const sourceOffset = view.byteOffset ?? 0;
    if (sourceOffset < previousSourceEnd) {
      throw new Error(`Overlapping buffer view ${viewIndex} is not supported`);
    }
    previousSourceEnd = sourceOffset + view.byteLength;
    const payload = optimizedImages.get(viewIndex)
      ?? Buffer.from(bin.subarray(sourceOffset, sourceOffset + view.byteLength));
    const alignedOffset = align4(logicalLength);
    if (alignedOffset > logicalLength) chunks.push(Buffer.alloc(alignedOffset - logicalLength));
    view.byteOffset = alignedOffset;
    view.byteLength = payload.length;
    chunks.push(payload);
    logicalLength = alignedOffset + payload.length;
  }

  const logicalBin = Buffer.concat(chunks, logicalLength);
  json.buffers[0].byteLength = logicalBin.length;
  const optimizedGlb = encodeGlb(json, logicalBin);
  const temporaryOutput = `${outputPath}.tmp-${process.pid}`;
  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  fs.writeFileSync(temporaryOutput, optimizedGlb);
  fs.renameSync(temporaryOutput, outputPath);
  console.log(`EMBEDDED_GLB_TEXTURES_OPTIMIZED ${JSON.stringify({
    input: inputPath,
    output: outputPath,
    maxDimension,
    beforeBytes: sourceBytes.length,
    afterBytes: optimizedGlb.length,
    resizedTextures: report.filter((entry) => entry.before.width !== entry.after.width).length,
    textures: report,
  })}`);
} finally {
  fs.rmSync(temporaryDirectory, {recursive: true, force: true});
}
