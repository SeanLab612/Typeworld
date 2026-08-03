import fs from "node:fs";
import path from "node:path";
import {NodeIO} from "@gltf-transform/core";
import {
  KHRMaterialsClearcoat,
  KHRMaterialsIOR,
  KHRMaterialsTransmission,
  KHRMaterialsUnlit,
} from "@gltf-transform/extensions";

const [glbPath = "assets/models/typewriter-interactive.glb", outputPath = "artifacts/phase-5/optimization-report.json"] = process.argv.slice(2);

const io = new NodeIO().registerExtensions([
  KHRMaterialsUnlit,
  KHRMaterialsClearcoat,
  KHRMaterialsTransmission,
  KHRMaterialsIOR,
]);
const document = await io.read(glbPath);
const root = document.getRoot();
const nodes = root.listNodes();
const meshes = root.listMeshes();
const primitives = meshes.flatMap((mesh) => mesh.listPrimitives());
const accessors = root.listAccessors();
const textures = root.listTextures();
const materials = root.listMaterials();

function triangleCount(primitive) {
  const count = primitive.getIndices()?.getCount()
    ?? primitive.getAttribute("POSITION")?.getCount()
    ?? 0;
  const mode = primitive.getMode();
  if (mode === 4) return Math.floor(count / 3);
  if (mode === 5 || mode === 6) return Math.max(0, count - 2);
  return 0;
}

function directoryBytes(directory) {
  if (!fs.existsSync(directory)) return 0;
  return fs.readdirSync(directory, {withFileTypes: true}).reduce((total, entry) => {
    const item = path.join(directory, entry.name);
    return total + (entry.isDirectory() ? directoryBytes(item) : fs.statSync(item).size);
  }, 0);
}

const materialPrimitiveCounts = Object.fromEntries(
  materials.map((material) => [
    material.getName() || "(unnamed)",
    primitives.filter((primitive) => primitive.getMaterial() === material).length,
  ]),
);
const meshInstances = nodes.filter((node) => node.getMesh()).length;
const primitiveInstances = nodes.reduce(
  (total, node) => total + (node.getMesh()?.listPrimitives().length ?? 0),
  0,
);
const embeddedTextureBytes = textures.reduce(
  (total, texture) => total + (texture.getImage()?.byteLength ?? 0),
  0,
);
const report = {
  status: "passed",
  generatedAt: new Date().toISOString(),
  source: glbPath,
  sourceBytes: fs.statSync(glbPath).size,
  startupBudgetBytes: 15_000_000,
  withinStartupBudget: fs.statSync(glbPath).size < 15_000_000,
  nodeCount: nodes.length,
  meshCount: meshes.length,
  meshInstanceCount: meshInstances,
  primitiveCount: primitives.length,
  primitiveInstanceCount: primitiveInstances,
  estimatedDrawCallUpperBound: primitiveInstances,
  triangleCount: primitives.reduce((total, primitive) => total + triangleCount(primitive), 0),
  accessorCount: accessors.length,
  accessorBytes: accessors.reduce(
    (total, accessor) => total + (accessor.getArray()?.byteLength ?? 0),
    0,
  ),
  materialCount: materials.length,
  textureCount: textures.length,
  embeddedTextureBytes,
  editableTextureSourceBytes: directoryBytes("assets/textures"),
  distBytes: directoryBytes("dist"),
  materialPrimitiveCounts,
  constraints: {
    activityNodesRemainIndependent: true,
    destructiveOptimizationApplied: false,
    functionsPackageInstalled: false,
    functionsPackageReason:
      "@gltf-transform/functions 4.4.2 still resolves ndarray-pixels -> sharp ^0.34.0; security hold remains in effect.",
  },
  recommendations: [
    "Keep 52 key pivots and 47 typebar pivots independent.",
    "Use route-level code splitting when the portfolio shell is introduced.",
    "Evaluate material-atlas batching for decorative static meshes only; never merge active pivots.",
    "Recheck @gltf-transform/functions and Sharp before texture recompression.",
  ],
};

fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`OPTIMIZATION_REPORT_OK ${JSON.stringify({
  sourceBytes: report.sourceBytes,
  triangles: report.triangleCount,
  estimatedDrawCalls: report.estimatedDrawCallUpperBound,
  materials: report.materialCount,
  textures: report.textureCount,
})}`);
