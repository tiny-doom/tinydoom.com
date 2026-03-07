import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error("DATABASE_URL is not set");
	return drizzle(neon(url), { schema });
}

// Lazy singleton — only connects when first accessed at runtime
let _db: ReturnType<typeof createDb>;
export const db = new Proxy({} as ReturnType<typeof createDb>, {
	get(_, prop) {
		if (!_db) _db = createDb();
		return Reflect.get(_db, prop);
	},
});

export { schema };
