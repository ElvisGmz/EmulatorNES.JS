import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildAssets } from "./art/index.mjs";
import { buildAudioData } from "./music/index.mjs";
import { CC65_ASMINC_DIR, CC65_INCLUDE_DIR, CC65_LIB_DIR, runTool } from "./tools/cc65.mjs";

const gameDir = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.join(gameDir, "src");
const outputFile = path.resolve(gameDir, "../../public/roms/claude-quest/claude-quest.nes");

const COMPILER_FLAGS = ["-t", "none", "-Oirs", "--static-locals", "-I", CC65_INCLUDE_DIR];

async function readSources() {
  const sources = {};
  for (const name of await readdir(sourceDir)) {
    sources[name] = new Uint8Array(await readFile(path.join(sourceDir, name)));
  }
  return sources;
}

async function compileC(name, sources) {
  const assemblyName = name.replace(/\.c$/, ".s");
  const { files, log } = await runTool("cc65", [...COMPILER_FLAGS, name, "-o", assemblyName], {
    inputs: sources,
    outputs: [assemblyName],
  });
  if (log.trim()) console.warn(log.trim());
  return { [assemblyName]: files[assemblyName] };
}

async function assemble(name, inputs) {
  const objectName = name.replace(/\.s$/, ".o");
  const { files } = await runTool("ca65", ["-t", "none", "-I", CC65_ASMINC_DIR, name, "-o", objectName], {
    inputs,
    outputs: [objectName],
  });
  return files[objectName];
}

/** Compiles the game and returns the ROM plus the linker map and labels (for tests and debugging). */
export async function buildRom() {
  const sources = await readSources();
  const encoder = new TextEncoder();
  const assets = buildAssets();
  const audio = buildAudioData();
  sources["chr.bin"] = assets.chr;
  sources["assets.h"] = encoder.encode(assets.header);
  sources["assets.c"] = encoder.encode(assets.source);
  sources["audio_data.h"] = encoder.encode(audio.header);
  sources["audio_data.c"] = encoder.encode(audio.source);

  const cFiles = Object.keys(sources).filter((name) => name.endsWith(".c"));
  const generatedAssembly = Object.assign({}, ...(await Promise.all(cFiles.map((name) => compileC(name, sources)))));

  const assemblyInputs = { ...sources, ...generatedAssembly };
  const assemblyFiles = Object.keys(assemblyInputs).filter((name) => name.endsWith(".s"));
  const objects = {};
  for (const name of assemblyFiles) objects[name.replace(/\.s$/, ".o")] = await assemble(name, assemblyInputs);

  const { files, log } = await runTool(
    "ld65",
    ["-C", "nrom.cfg", "-m", "game.map", "-Ln", "game.labels", "-o", "game.nes", ...Object.keys(objects), `${CC65_LIB_DIR}/none.lib`],
    { inputs: { "nrom.cfg": sources["nrom.cfg"], ...objects }, outputs: ["game.nes", "game.map", "game.labels"] },
  );
  if (log.trim()) console.warn(log.trim());

  const decoder = new TextDecoder();
  return { rom: files["game.nes"], map: decoder.decode(files["game.map"]), labels: decoder.decode(files["game.labels"]) };
}

async function main() {
  const startedAt = performance.now();
  const { rom, map, labels } = await buildRom();

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, rom);
  await writeFile(path.join(gameDir, "game.map"), map);
  await writeFile(path.join(gameDir, "game.labels"), labels);

  const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
  console.log(`Built ${path.relative(process.cwd(), outputFile)} (${rom.length} bytes) in ${seconds}s`);
}

const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) await main();
