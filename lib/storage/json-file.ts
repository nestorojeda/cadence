import fs from "fs/promises";
import path from "path";

export async function writeJsonAtomic(file: string, value: unknown, space?: number): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, space), "utf-8");
  await fs.rename(tmp, file);
}
