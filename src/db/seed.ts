import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "./client";
import { niceToHaveItems, styleProfiles } from "./schema";
import { NICE_TO_HAVE_DEFAULTS, STYLE_PROFILE_DEFAULTS } from "./seed-data";
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

  for (const profile of STYLE_PROFILE_DEFAULTS) {
    await db
      .insert(styleProfiles)
      .values(profile)
      .onConflictDoUpdate({
        target: styleProfiles.key,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          promptGuidance: sql`excluded.prompt_guidance`,
          sortOrder: sql`excluded.sort_order`,
          isDefault: sql`excluded.is_default`,
        },
      });
  }
  console.log(`Seeded ${STYLE_PROFILE_DEFAULTS.length} style profiles.`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
