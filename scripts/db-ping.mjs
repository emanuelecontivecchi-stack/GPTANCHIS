import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const schemaName = process.env.ANCHISE_DB_SCHEMA ?? "anchise_control_v1";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schemaName)) {
  throw new Error(`Invalid ANCHISE_DB_SCHEMA value: ${schemaName}`);
}

const sql = postgres(databaseUrl, {
  prepare: false,
  connection: {
    application_name: "anchise_gpt_db_ping",
    options: `-c search_path=${schemaName},public`
  }
});

try {
  const result = await sql`
    select
      current_database() as database_name,
      current_user as db_user,
      current_schema() as schema_name,
      now() as checked_at
  `;

  console.log(JSON.stringify(result[0], null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
