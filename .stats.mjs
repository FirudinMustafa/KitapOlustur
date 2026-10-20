import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const [row] = await neon(process.env.DATABASE_URL).query("select pending_content_approval p from generation_runs where id=$1", [process.argv[2]]);
for (const u of row.p.units) for (const f of ["studentBookPages", "workbookPages"]) {
  console.log(`\nUnit ${u.unitNumber} ${f}:`);
  for (const p of u[f] ?? []) {
    const chars = p.blocks.reduce((n, b) => n + b.body.length + (b.items ?? []).join("").length + (b.dialogue ?? []).map((d) => d.line).join("").length, 0);
    const feats = p.blocks.map((b) => (b.dialogue?.length ? "dlg" : b.table ? "tbl" : b.callout ? "co" : b.items?.length ? "ex" : b.kind[0])).join(",");
    console.log(`  p${p.sourcePageNumber} ${(p.layoutTemplate ?? "-").padEnd(24)} img:${p.imagePrompt ? "Y" : "-"} chars:${String(chars).padStart(4)} [${feats}] ${(p.sectionLabel ?? "").slice(0, 40)}`);
  }
}
