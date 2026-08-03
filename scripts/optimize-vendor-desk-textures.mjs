import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const PNG_SIGNATURE = "89504e470d0a1a0a";

const [
  inputPath = "assets/models/vendor/wooden-retro-desk.glb",
  outputPath = inputPath,
  maxDimensionArg = "2048",
] = process.argv.slice(2);
const maxDimension = Number.parseInt(maxDimensionArg, 10);

if (!Number.isInteger(maxDimension) || maxDimension < 256) {
  throw new Error(`Invalid maximum texture dimension: ${maxDimensionArg}`);
}

function align4(value) {
  return (value + 3) & ~3;
}

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
    throw new Error("Expected an embedded PNG texture");
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
const images = json.images ?? [];
if (images.length !== 3) throw new Error(`Expected 3 desk textures, found ${images.length}`);

const imageEntries = images.map((image, imageIndex) => {
  if (image.mimeType !== "image/png" || !Number.isInteger(image.bufferView)) {
    throw new Error(`Texture ${imageIndex} is not an embedded PNG`);
  }
  const view = json.bufferViews[image.bufferView];
  return {imageIndex, viewIndex: image.bufferView, view};
}).sort((a, b) => a.view.byteOffset - b.view.byteOffset);

const firstImageView = imageEntries[0].viewIndex;
if (
  imageEntries.some((entry, index) => entry.viewIndex !== firstImageView + index)
  || firstImageView + imageEntries.length !== json.bufferViews.length
) {
  throw new Error("Desk textures must be the final contiguous buffer views");
}

const firstImageOffset = imageEntries[0].view.byteOffset;
const chunks = [Buffer.from(bin.subarray(0, firstImageOffset))];
let logicalLength = firstImageOffset;
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "desk-textures-"));
const report = [];

try {
  for (const entry of imageEntries) {
    const sourceImage = Buffer.from(
      bin.subarray(entry.view.byteOffset, entry.view.byteOffset + entry.view.byteLength),
    );
    const before = pngDimensions(sourceImage);
    const inputImagePath = path.join(temporaryDirectory, `texture-${entry.imageIndex}-input.png`);
    const outputImagePath = path.join(temporaryDirectory, `texture-${entry.imageIndex}-output.png`);
    fs.writeFileSync(inputImagePath, sourceImage);

    let optimizedImage = sourceImage;
    if (Math.max(before.width, before.height) > maxDimension) {
      execFileSync(
        "/usr/bin/sips",
        ["--resampleHeightWidthMax", String(maxDimension), inputImagePath, "--out", outputImagePath],
        {stdio: "pipe"},
      );
      optimizedImage = fs.readFileSync(outputImagePath);
    }

    const alignedOffset = align4(logicalLength);
    if (alignedOffset > logicalLength) chunks.push(Buffer.alloc(alignedOffset - logicalLength));
    entry.view.byteOffset = alignedOffset;
    entry.view.byteLength = optimizedImage.length;
    chunks.push(optimizedImage);
    logicalLength = alignedOffset + optimizedImage.length;

    report.push({
      name: entry.view.name ?? `image-${entry.imageIndex}`,
      before,
      after: pngDimensions(optimizedImage),
      beforeBytes: sourceImage.length,
      afterBytes: optimizedImage.length,
    });
  }

  const logicalBin = Buffer.concat(chunks, logicalLength);
  json.buffers[0].byteLength = logicalBin.length;
  const optimizedGlb = encodeGlb(json, logicalBin);
  const temporaryOutput = `${outputPath}.tmp-${process.pid}`;
  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  fs.writeFileSync(temporaryOutput, optimizedGlb);
  fs.renameSync(temporaryOutput, outputPath);

  console.log(`VENDOR_DESK_TEXTURES_OPTIMIZED ${JSON.stringify({
    input: inputPath,
    output: outputPath,
    maxDimension,
    beforeBytes: sourceBytes.length,
    afterBytes: optimizedGlb.length,
    textures: report,
  })}`);
} finally {
  fs.rmSync(temporaryDirectory, {recursive: true, force: true});
}
