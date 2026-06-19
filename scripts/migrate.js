// Usage: node scripts/migrate.js <path-to-sql-file>
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: ".env.local" });

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error("Usage: node scripts/migrate.js <path-to-sql-file>");
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(sqlFile), "utf8");

// Split SQL into statements, respecting $$-quoted blocks
function splitStatements(sql) {
  const stmts = [];
  let current = "";
  let inDollarQuote = false;
  let i = 0;
  while (i < sql.length) {
    if (!inDollarQuote && sql.slice(i, i + 2) === "$$") {
      inDollarQuote = true;
      current += "$$";
      i += 2;
    } else if (inDollarQuote && sql.slice(i, i + 2) === "$$") {
      inDollarQuote = false;
      current += "$$";
      i += 2;
    } else if (!inDollarQuote && sql[i] === ";") {
      const trimmed = current.trim();
      if (trimmed) stmts.push(trimmed);
      current = "";
      i++;
    } else {
      current += sql[i];
      i++;
    }
  }
  const trimmed = current.trim();
  if (trimmed) stmts.push(trimmed);
  return stmts;
}

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const statements = splitStatements(sql);
  let errors = 0;

  for (const stmt of statements) {
    try {
      await client.query(stmt);
    } catch (err) {
      if (err.code === "42710") continue; // policy already exists — skip
      console.error(`  ✗ ${err.message}`);
      errors++;
    }
  }

  await client.end();

  if (errors === 0) {
    console.log(`✓ ${sqlFile}`);
  } else {
    console.error(`✗ ${sqlFile} — ${errors} error(s)`);
    process.exit(1);
  }
}

run().catch((err) => { console.error(err.message); process.exit(1); });
