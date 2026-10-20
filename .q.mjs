import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
console.log(JSON.stringify(await neon(process.env.DATABASE_URL).query(process.argv[2]), null, 1));
