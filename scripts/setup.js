import { readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
const template = await readFile(
  new URL("../.env.example", import.meta.url),
  "utf8",
);
const content = template
  .replace(
    "replace-with-a-random-secret-of-at-least-32-characters",
    crypto.randomBytes(48).toString("hex"),
  )
  .replace(
    "replace-with-another-random-secret-at-least-32-characters",
    crypto.randomBytes(48).toString("hex"),
  )
  .replace("SEED_PASSWORD=", "SEED_PASSWORD=LocalRide-2026!");
try {
  await writeFile(new URL("../.env", import.meta.url), content, {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    "Created .env with random JWT secrets and a development-only seed password.",
  );
} catch (err) {
  if (err.code === "EEXIST")
    console.log(".env already exists; left it unchanged.");
  else throw err;
}
