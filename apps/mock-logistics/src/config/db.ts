import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const db = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function initDatabase() {
  try {
    console.log(`[MockLogistics DB] 尝试连接到 PostgreSQL...`);
    const client = await db.connect();
    await client.query("CREATE EXTENSION IF NOT EXISTS postgis");
    client.release();
    console.log(`[MockLogistics DB] 连接成功，PostGIS 扩展已启用/检查。`);
  } catch (error) {
    console.error(`[MockLogistics DB] 致命错误：无法连接到数据库。`, error);
    throw error;
  }
}

export async function query<T>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = await db.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

db.on("error", (err) => {
  console.error("[MockLogistics DB] Unexpected error on idle client", err);
  process.exit(-1);
});
