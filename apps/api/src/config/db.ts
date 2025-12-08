import pg from "pg";
import { config } from "./config";

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
    console.log(`[DB] 尝试连接到 PostgreSQL...`);
    // 尝试获取一个连接来验证连接是否成功
    const client = await db.connect();

    // 确保 PostGIS 扩展已安装
    await client.query("CREATE EXTENSION IF NOT EXISTS postgis");

    client.release();
    console.log(`[DB] 连接成功，PostGIS 扩展已启用/检查。`);
  } catch (error) {
    console.error(`[DB] 致命错误：无法连接到数据库。`, error);
    throw error; // 阻止应用启动
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
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});
