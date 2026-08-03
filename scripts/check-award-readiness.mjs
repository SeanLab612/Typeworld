import {readFile} from "node:fs/promises";

const productionOrigin = "https://the0612.com";
const socialImage = `${productionOrigin}/brand/typeworld-social-preview-v1.jpg`;
const socialImagePath = "assets/brand/typeworld-social-preview-v1.jpg";
const entries = [
  {file: "index.html", canonical: `${productionOrigin}/`, title: "Typeworld"},
  {
    file: "projects.html",
    canonical: `${productionOrigin}/projects.html`,
    title: "Typeworld · Library",
  },
  {
    file: "project.html",
    canonical: `${productionOrigin}/project.html`,
    title: "Typeworld · Library Volume",
  },
];

const requiredFragments = [
  '<meta name="description"',
  '<meta name="robots" content="index,follow"',
  '<meta property="og:title"',
  '<meta property="og:description"',
  '<meta property="og:type"',
  '<meta property="og:site_name" content="Typeworld"',
  '<meta property="og:url"',
  '<meta property="og:image"',
  '<meta property="og:image:width" content="1200"',
  '<meta property="og:image:height" content="630"',
  '<meta property="og:image:alt"',
  '<meta name="twitter:card" content="summary_large_image"',
  '<meta name="twitter:title"',
  '<meta name="twitter:description"',
  '<meta name="twitter:image"',
  '<meta name="twitter:image:alt"',
  '<link rel="canonical"',
  '<link rel="icon" href="/brand/typeworld-mark.svg"',
];

const failures = [];

try {
  const image = await readFile(socialImagePath);
  let dimensions = null;
  if (image[0] === 0xff && image[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < image.length) {
      if (image[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = image[offset + 1];
      const segmentLength = image.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        dimensions = {
          width: image.readUInt16BE(offset + 7),
          height: image.readUInt16BE(offset + 5),
        };
        break;
      }
      if (segmentLength < 2) break;
      offset += segmentLength + 2;
    }
  }
  if (!dimensions) {
    failures.push(`${socialImagePath}: expected a readable JPEG image`);
  } else if (dimensions.width !== 1200 || dimensions.height !== 630) {
    failures.push(`${socialImagePath}: expected 1200x630, found ${dimensions.width}x${dimensions.height}`);
  }
} catch {
  failures.push(`${socialImagePath}: social preview image is missing`);
}

for (const entry of entries) {
  const html = await readFile(entry.file, "utf8");
  const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? "";

  for (const fragment of requiredFragments) {
    if (!head.includes(fragment)) failures.push(`${entry.file}: missing ${fragment}`);
  }

  if (!head.includes(`<title>${entry.title}</title>`)) {
    failures.push(`${entry.file}: expected title ${entry.title}`);
  }
  if (!head.includes(`<link rel="canonical" href="${entry.canonical}"`)) {
    failures.push(`${entry.file}: expected canonical ${entry.canonical}`);
  }
  if (!head.includes(`<meta property="og:image" content="${socialImage}"`)) {
    failures.push(`${entry.file}: expected social image ${socialImage}`);
  }
  if (!head.includes(`<meta name="twitter:image" content="${socialImage}"`)) {
    failures.push(`${entry.file}: expected Twitter image ${socialImage}`);
  }
  if (/localhost|127\.0\.0\.1|Typeword(?!l)/i.test(head)) {
    failures.push(`${entry.file}: development URL or retired Typeword brand found in head`);
  }
}

const publicRuntimeSource = await readFile("src/main.ts", "utf8");
for (const forbiddenCopy of [
  "Phase 7 将在",
  "MOCK PLACEHOLDER",
  "ABOUT SEAN HU",
  "PROJECTS ARCHIVE",
]) {
  if (publicRuntimeSource.includes(forbiddenCopy)) {
    failures.push(`src/main.ts: public development copy remains: ${forbiddenCopy}`);
  }
}

if (failures.length > 0) {
  console.error("Award readiness metadata check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Award readiness metadata check passed for ${entries.length} public entries.`);
  console.log(`Social preview image configured: ${socialImage}`);
}
