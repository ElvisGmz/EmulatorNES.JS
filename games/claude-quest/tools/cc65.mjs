import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { shareDir, toolchain } from "romdev-toolchain-cc65";

const WORK_DIR = "/work";
const SHARE_MOUNT = "/cc65";
const SHARE_SUBDIRS_BY_TOOL = { cc65: ["include"], ca65: ["asminc"], ld65: ["lib", "cfg"] };

const shareCache = new Map();

async function readShareSubdir(subdir) {
  if (shareCache.has(subdir)) return shareCache.get(subdir);

  const files = [];
  const walk = async (hostDir, virtualDir) => {
    for (const entry of await readdir(hostDir, { withFileTypes: true })) {
      const hostPath = path.join(hostDir, entry.name);
      const virtualPath = `${virtualDir}/${entry.name}`;
      if (entry.isDirectory()) await walk(hostPath, virtualPath);
      else files.push({ virtualPath, bytes: new Uint8Array(await readFile(hostPath)) });
    }
  };
  await walk(path.join(shareDir, subdir), `${SHARE_MOUNT}/${subdir}`);

  shareCache.set(subdir, files);
  return files;
}

function ensureDirectory(fs, directory) {
  let current = "";
  for (const part of directory.split("/").filter(Boolean)) {
    current += `/${part}`;
    try {
      fs.mkdir(current);
    } catch {
      // Already exists
    }
  }
}

/**
 * Runs one cc65 tool (cc65, ca65 or ld65) compiled to WebAssembly inside an
 * in-memory filesystem. `inputs` maps file names to bytes; `outputs` lists the
 * file names to read back after the run.
 */
export async function runTool(tool, args, { inputs = {}, outputs = [] } = {}) {
  const gluePath = toolchain[tool]?.gluePath;
  if (!gluePath) throw new Error(`Unknown cc65 tool: ${tool}`);

  let log = "";
  let exitStatus = 0;
  const createModule = (await import(gluePath)).default;
  const module = await createModule({
    wasmBinary: await readFile(gluePath.replace(/\.js$/, ".wasm")),
    noInitialRun: true,
    print: (line) => (log += `${line}\n`),
    printErr: (line) => (log += `${line}\n`),
    quit: (status, error) => {
      exitStatus = status;
      throw error;
    },
  });
  const fs = module.FS;

  for (const subdir of SHARE_SUBDIRS_BY_TOOL[tool] ?? []) {
    for (const { virtualPath, bytes } of await readShareSubdir(subdir)) {
      ensureDirectory(fs, path.posix.dirname(virtualPath));
      fs.writeFile(virtualPath, bytes);
    }
  }

  ensureDirectory(fs, WORK_DIR);
  for (const [name, bytes] of Object.entries(inputs)) {
    ensureDirectory(fs, path.posix.dirname(`${WORK_DIR}/${name}`));
    fs.writeFile(`${WORK_DIR}/${name}`, bytes);
  }
  fs.chdir(WORK_DIR);

  const originalExitCode = process.exitCode;
  try {
    module.callMain([...args]);
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) exitStatus = error.status;
    else if (exitStatus === 0) throw error;
  }
  if (process.exitCode && process.exitCode !== originalExitCode) {
    exitStatus ||= Number(process.exitCode);
    process.exitCode = originalExitCode;
  }

  if (exitStatus !== 0) {
    throw new Error(`${tool} ${args.join(" ")} failed (${exitStatus}):\n${log}`);
  }

  const results = {};
  for (const name of outputs) results[name] = fs.readFile(`${WORK_DIR}/${name}`);
  return { log, files: results };
}

export const CC65_INCLUDE_DIR = `${SHARE_MOUNT}/include`;
export const CC65_ASMINC_DIR = `${SHARE_MOUNT}/asminc`;
export const CC65_LIB_DIR = `${SHARE_MOUNT}/lib`;
