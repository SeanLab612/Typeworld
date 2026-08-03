import fs from "node:fs";
import path from "node:path";
import {NodeIO} from "@gltf-transform/core";
import {
  KHRMaterialsClearcoat,
  KHRMaterialsIOR,
  KHRMaterialsTransmission,
  KHRMaterialsUnlit,
} from "@gltf-transform/extensions";

const [keyboardPath, glbPath, blenderReportPath] = process.argv.slice(2);
if (!keyboardPath || !glbPath || !blenderReportPath) {
  throw new Error("Usage: validate-blockout.mjs <keyboard.json> <model.glb> <blender-report.json>");
}

const keyboard = JSON.parse(fs.readFileSync(keyboardPath, "utf8"));
const blenderReport = JSON.parse(fs.readFileSync(blenderReportPath, "utf8"));
const keys = keyboard.keys;
const printable = keys.filter((key) => key.kind === "print");

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

expect(keys.length === 52, `Expected 52 keys, found ${keys.length}`);
expect(printable.length === 47, `Expected 47 typebar keys, found ${printable.length}`);
expect(new Set(keys.map((key) => key.id)).size === 52, "Key IDs must be unique");
expect(new Set(keys.map((key) => key.code)).size === 52, "KeyboardEvent codes must be unique");

const io = new NodeIO().registerExtensions([
  KHRMaterialsUnlit,
  KHRMaterialsClearcoat,
  KHRMaterialsTransmission,
  KHRMaterialsIOR,
]);
const document = await io.read(glbPath);
const nodes = document.getRoot().listNodes();
const nodeNames = nodes.map((node) => node.getName());
const counts = new Map();
for (const name of nodeNames) counts.set(name, (counts.get(name) ?? 0) + 1);

const requireUnique = (name) => {
  expect(counts.get(name) === 1, `Expected exactly one GLB node ${name}, found ${counts.get(name) ?? 0}`);
};

for (const key of keys) {
  requireUnique(`KEY_${key.id}_PIVOT`);
  requireUnique(`KEY_${key.id}_MESH`);
  requireUnique(`HIT_KEY_${key.id}`);
  requireUnique(`LINK_${key.id}_PIVOT`);
}
for (const key of printable) {
  requireUnique(`TYPEBAR_${key.id}_PIVOT`);
  requireUnique(`TYPEBAR_${key.id}_HEAD`);
}
for (const name of [
  "TYPEWRITER_ROOT",
  "FRAME_ROOT",
  "CARRIAGE_ROOT",
  "PLATEN_PIVOT",
  "PAPER_MESH",
  "RETURN_LEVER_PIVOT",
  "RIBBON_LEFT_SPOOL_PIVOT",
  "RIBBON_RIGHT_SPOOL_PIVOT",
  "RIBBON_STRIKE_ZONE_PIVOT",
  "BELL_HAMMER_PIVOT",
]) {
  requireUnique(name);
}

const fileSizeBytes = fs.statSync(glbPath).size;
const isInteraction = blenderReport.phase === "phase-4-interaction";
const isMaterials = blenderReport.phase === "phase-3-materials" || isInteraction;
const isMechanism = blenderReport.phase === "phase-2-mechanism" || isMaterials;
// Phase 3/4 prioritizes close-up PBR quality. The complete typewriter +
// environment payload is still checked against the PLAN's 15 MB target.
const maxFileSizeBytes = isMaterials ? 12_000_000 : (isMechanism ? 5_000_000 : 3_000_000);
const maxTriangles = isMaterials ? 150_000 : (isMechanism ? 100_000 : 60_000);
expect(fileSizeBytes < maxFileSizeBytes, `GLB exceeds ${maxFileSizeBytes} bytes: ${fileSizeBytes} bytes`);
expect(blenderReport.triangleCount < maxTriangles, `Triangle budget exceeded: ${blenderReport.triangleCount}`);
expect(blenderReport.validationErrors.length === 0, `Blender validation errors: ${blenderReport.validationErrors.join("; ")}`);
if (isMechanism) {
  for (const keyId of ["A", "M", "Z"]) {
    const clearance = blenderReport.strikeClearanceMeters?.[keyId];
    expect(typeof clearance === "number", `Missing ${keyId} strike clearance`);
    expect(clearance <= 0.002, `${keyId} misses print point by ${clearance} m`);
  }
}
if (isMaterials) {
  for (const key of keys.filter((candidate) => candidate.id !== "SPACE")) {
    requireUnique(`KEY_${key.id}_GLASS`);
  }
  for (const name of [
    "DETAIL_ROOT",
    "TYPEBASKET_ESCUTCHEON",
    "FRAME_FRONT_WEAR_STRIP",
    "CARRIAGE_SCALE_STRIP",
    "RIBBON_LEFT_RED_STRIPE",
    "RIBBON_STRIKE_RED_STRIPE",
    "RIBBON_RIGHT_RED_STRIPE",
  ]) {
    requireUnique(name);
  }
  expect(
    blenderReport.frontRailTopRowClearanceMeters >= 0.006,
    `Front chrome rail top-row clearance is ${blenderReport.frontRailTopRowClearanceMeters} m`,
  );
  expect(
    blenderReport.sideCutoutSurfaceGapMeters >= 0.0015,
    `Side cheek surface gap is ${blenderReport.sideCutoutSurfaceGapMeters} m`,
  );
  expect(
    blenderReport.footBottomSpreadMeters <= 0.0005,
    `Foot bottom spread is ${blenderReport.footBottomSpreadMeters} m`,
  );
  expect(
    Math.abs(blenderReport.footLowestZMeters) <= 0.0005,
    `Foot lowest Z is ${blenderReport.footLowestZMeters} m`,
  );
}
if (isInteraction) {
  expect(
    blenderReport.paperVertexCount >= 1000,
    `Flexible paper has only ${blenderReport.paperVertexCount} vertices`,
  );
  expect(blenderReport.paperHasUV === true, "Flexible paper is missing UV coordinates");
  expect(blenderReport.paperFlexible === true, "Flexible paper metadata is missing");
}

const report = {
  status: "passed",
  glb: path.relative(process.cwd(), glbPath),
  glbBytes: fileSizeBytes,
  phase: blenderReport.phase,
  nodeCount: nodes.length,
  keyPivotCount: keys.length,
  typebarPivotCount: printable.length,
  triangleCount: blenderReport.triangleCount,
  blenderObjectCount: blenderReport.objectCount,
};

fs.writeFileSync(
  path.join(path.dirname(blenderReportPath), "gltf-validation-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

console.log(`BLOCKOUT_GLTF_OK ${JSON.stringify(report)}`);
