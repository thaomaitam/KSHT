import fs from "node:fs";
import path from "node:path";

export const migrationPath = (): string =>
  path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../migrations/0001_init.sql");

export const readMigrationSql = (): string => fs.readFileSync(migrationPath(), "utf8");

export const applySql = (exec: (sql: string) => void, sql = readMigrationSql()): void => {
  for (const statement of sql.split(";")) {
    const trimmed = statement.trim();
    if (trimmed) exec(trimmed);
  }
};
