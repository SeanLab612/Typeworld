import fs from "node:fs";
import path from "node:path";
import {NodeIO} from "@gltf-transform/core";
import {KHRMaterialsEmissiveStrength, KHRMaterialsUnlit} from "@gltf-transform/extensions";

const [glbPath, blenderReportPath] = process.argv.slice(2);
if (!glbPath || !blenderReportPath) {
  throw new Error("Usage: validate-environment.mjs <environment.glb> <blender-report.json>");
}

const report = JSON.parse(fs.readFileSync(blenderReportPath, "utf8"));
const document = await new NodeIO().registerExtensions([
  KHRMaterialsUnlit,
  KHRMaterialsEmissiveStrength,
]).read(glbPath);
const nodes = document.getRoot().listNodes();
const counts = new Map();
for (const node of nodes) counts.set(node.getName(), (counts.get(node.getName()) ?? 0) + 1);

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
const requireUnique = (name) => {
  expect(counts.get(name) === 1, `Expected exactly one environment node ${name}`);
};

for (const name of [
  "ENVIRONMENT_ROOT",
  "DESK_ROOT",
  "DESK_TOP",
  "DRAWER_LEFT_PIVOT",
  "DRAWER_LEFT_BODY",
  "DRAWER_LEFT_FRONT",
  "DRAWER_LEFT_ARCHIVE_SLOT",
  "HIT_DRAWER_LEFT",
  "DRAWER_RIGHT_PIVOT",
  "DRAWER_RIGHT_BODY",
  "DRAWER_RIGHT_FRONT",
  "DRAWER_RIGHT_ARCHIVE_SLOT",
  "HIT_DRAWER_RIGHT",
]) {
  requireUnique(name);
}

for (const side of ["LEFT", "RIGHT"]) {
  const drawer = nodes.find((node) => node.getName() === `DRAWER_${side}_PIVOT`);
  const archive = nodes.find((node) => node.getName() === `DRAWER_${side}_ARCHIVE_SLOT`);
  expect(
    drawer?.listChildren().includes(archive),
    `DRAWER_${side}_ARCHIVE_SLOT must remain parented to DRAWER_${side}_PIVOT`,
  );
}
expect(report.drawerOpenTravelMeters.left >= 0.28, "Left drawer travel is too short for paper access");
expect(report.drawerOpenTravelMeters.right >= 0.28, "Right drawer travel is too short for paper access");
expect(report.archiveCapacity.total >= 20, "Combined drawer archive capacity is below the Phase 6 interface target");
expect(report.triangleCount < 55_000, `Environment triangle budget exceeded: ${report.triangleCount}`);
expect(fs.statSync(glbPath).size < 4_000_000, "Environment GLB exceeds 4 MB");
expect(report.validationErrors.length === 0, `Blender environment errors: ${report.validationErrors.join("; ")}`);

const validation = {
  status: "passed",
  glb: path.relative(process.cwd(), glbPath),
  glbBytes: fs.statSync(glbPath).size,
  nodeCount: nodes.length,
  triangleCount: report.triangleCount,
  drawerOpenTravelMeters: report.drawerOpenTravelMeters,
  archiveCapacity: report.archiveCapacity,
  generatedTextures: report.generatedTextures,
};
fs.writeFileSync(
  path.join(path.dirname(blenderReportPath), "gltf-validation-report.json"),
  `${JSON.stringify(validation, null, 2)}\n`,
);
console.log(`ENVIRONMENT_GLTF_OK ${JSON.stringify(validation)}`);
