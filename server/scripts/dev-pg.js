// Dev convenience: spins up a local embedded Postgres cluster so you can run
// the server without installing/managing Postgres yourself. Not used in
// production — Railway's managed Postgres plugin is the real datastore there.
const path = require("path");
const EmbeddedPostgres = require("embedded-postgres").default || require("embedded-postgres");

const dataDir = path.join(__dirname, "..", ".devdata", "pg");

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 55432,
  persistent: true,
});

async function main() {
  await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase("framefriends");
  } catch (e) {
    // already exists — fine
  }
  console.log("DEV_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/framefriends");
  console.log("embedded postgres running — Ctrl+C to stop");
}

process.on("SIGINT", async () => {
  await pg.stop();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await pg.stop();
  process.exit(0);
});

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
