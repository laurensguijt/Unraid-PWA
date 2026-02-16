import fs from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "data");
const auditFile = path.resolve(dataDir, "audit.log");

export async function writeAuditLog(entry: {
  action: string;
  target: string;
  result: "ok" | "failed";
}): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
  await fs.appendFile(auditFile, `${line}\n`, "utf8");
}
