#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveEsbuildBinary(projectDir) {
  const commandText = process.argv.slice(4).join(" ").toLowerCase();
  const preferViteBinary = commandText.includes("vite") || commandText.includes("vitest");

  const packageRoots = preferViteBinary
    ? [
        path.join(projectDir, "node_modules", "vite", "node_modules", "@esbuild"),
        path.join(projectDir, "node_modules", "@esbuild"),
      ]
    : [
        path.join(projectDir, "node_modules", "@esbuild"),
        path.join(projectDir, "node_modules", "vite", "node_modules", "@esbuild"),
      ];

  const candidates = [];
  for (const packageRoot of packageRoots) {
    let entries;
    try {
      entries = await fs.readdir(packageRoot, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const platformDir = path.join(packageRoot, entry.name);
      candidates.push(path.join(platformDir, "bin", "esbuild"));
      candidates.push(path.join(platformDir, "bin", "esbuild.exe"));
      candidates.push(path.join(platformDir, "esbuild.exe"));
    }
  }

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function ensureRunnableEsbuildBinary(projectDir) {
  const sourceBinary = await resolveEsbuildBinary(projectDir);
  if (!sourceBinary) {
    return null;
  }

  const isWindows = process.platform === "win32";
  const destination = path.join(
    os.tmpdir(),
    `unraid-pwa-esbuild-${path.basename(projectDir)}${isWindows ? ".exe" : ""}`,
  );
  await fs.copyFile(sourceBinary, destination);
  if (!isWindows) {
    await fs.chmod(destination, 0o755);
  }
  return destination;
}

const [, , projectDirArg, ...command] = process.argv;

if (!projectDirArg || command.length === 0) {
  console.error(
    "Usage: node scripts/with-esbuild-binary.mjs <project-dir> <command> [args...]",
  );
  process.exit(1);
}

const projectDir = path.resolve(process.cwd(), projectDirArg);
const injectedBinaryPath = await ensureRunnableEsbuildBinary(projectDir);

const env = { ...process.env };
if (injectedBinaryPath) {
  env.ESBUILD_BINARY_PATH = injectedBinaryPath;
  env.npm_config_esbuild_binary_path = injectedBinaryPath;
}

const child = spawn(command[0], command.slice(1), {
  cwd: projectDir,
  env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
