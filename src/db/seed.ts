import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "./client";
import { niceToHaveItems } from "./schema";
import { NICE_TO_HAVE_DEFAULTS } from "./seed-data";
import { sql } from "drizzle-orm";

async function main() {
  for (const item of NICE_TO_HAVE_DEFAULTS) {
    await db
      .insert(niceToHaveItems)
      .values(item)
      .onConflictDoUpdate({
        target: niceToHaveItems.key,
        set: {
          label: sql`excluded.label`,
          description: sql`excluded.description`,
          sortOrder: sql`excluded.sort_order`,
          isDefaultSelected: sql`excluded.is_default_selected`,
        },
      });
  }

  console.log(`Seeded ${NICE_TO_HAVE_DEFAULTS.length} nice-to-have items.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
