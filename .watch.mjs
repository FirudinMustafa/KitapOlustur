import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const sql = neon(process.env.DATABASE_URL);
const [id, secs = "540", seenArg = ""] = process.argv.slice(2);
const until = Date.now() + Number(secs) * 1000;
const seen = new Set(seenArg.split(",").filter(Boolean));
let last = "";
while (Date.now() < until) {
  let r;
  try { [r] = await sql.query("select status, current_stage, error_message from generation_runs where id=$1", [id]); } catch { await new Promise((res) => setTimeout(res, 5000)); continue; }
  const line = `${r.status} | ${r.current_stage ?? ""}${r.error_message ? " | ERR " + r.error_message : ""}`;
  if (line !== last) { console.log(new Date().toISOString().slice(11, 19), line); last = line; }
  if ((r.status.startsWith("awaiting_") || ["done", "failed", "changes_requested"].includes(r.status)) && !seen.has(r.status)) { console.log("STOP", r.status); break; }
  await new Promise((res) => setTimeout(res, 15000));
}
