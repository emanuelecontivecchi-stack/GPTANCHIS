import postgres, { type Sql } from "postgres";

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required for the API database client.`);
  }

  return value;
}

function readSchemaName(): string {
  const schemaName = process.env.ANCHISE_DB_SCHEMA ?? "anchise_control_v1";

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schemaName)) {
    throw new Error(`Invalid ANCHISE_DB_SCHEMA value: ${schemaName}`);
  }

  return schemaName;
}

let cachedDb: Sql<Record<string, unknown>> | null = null;

export function getDb(): Sql<Record<string, unknown>> {
  if (!cachedDb) {
    const databaseUrl = requireEnv("DATABASE_URL", process.env.DATABASE_URL);
    const schemaName = readSchemaName();

    cachedDb = postgres(databaseUrl, {
      prepare: false,
      connection: {
        application_name: "anchise_api",
        options: `-c search_path=${schemaName},public`
      }
    });
  }

  return cachedDb;
}

export function getDbSchemaName(): string {
  return readSchemaName();
}

export async function closeDb(): Promise<void> {
  if (!cachedDb) {
    return;
  }

  const db = cachedDb;
  cachedDb = null;
  await db.end({ timeout: 5 });
}
