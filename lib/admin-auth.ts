import "server-only";
import { headers } from "next/headers";
import { config } from "./config";

// Server actions can be invoked from any path, so re-check admin auth inside each one.
export async function requireAdmin() {
  const auth = (await headers()).get("authorization") ?? "";
  const given = auth.startsWith("Basic ") ? Buffer.from(auth.slice(6), "base64").toString().split(":")[1] : "";
  if (!config.adminPassword || given !== config.adminPassword) throw new Error("unauthorized");
}
