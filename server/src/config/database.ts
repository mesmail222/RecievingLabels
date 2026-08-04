import path from 'path';
import fs from 'fs';
import sql from 'mssql';
import dotenv from 'dotenv';

const serverEnv = path.resolve(__dirname, '../../.env');
const cwdEnv = path.resolve(process.cwd(), '.env');
const cwdServerEnv = path.resolve(process.cwd(), 'server', '.env');
for (const envPath of [serverEnv, cwdServerEnv, cwdEnv]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in server/.env before starting the API.`,
    );
  }
  return value;
}

/** @types/mssql IOptions is incomplete vs runtime tedious options */
interface ExtendedConfig extends sql.config {
  options: {
    encrypt?: boolean;
    trustServerCertificate?: boolean;
    enableArithAbort?: boolean;
    connectTimeout?: number;
    requestTimeout?: number;
  };
}

const config: ExtendedConfig = {
  server: requireEnv('DATABASE_SERVER'),
  database: requireEnv('DATABASE_NAME'),
  user: requireEnv('DATABASE_USER'),
  password: requireEnv('DATABASE_PASSWORD'),
  options: {
    encrypt: process.env.DATABASE_ENCRYPT === 'true' || false,
    trustServerCertificate: process.env.DATABASE_TRUST_CERT !== 'false',
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 120000,
  },
  pool: {
    max: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
    min: parseInt(process.env.DATABASE_POOL_MIN || '0', 10),
    idleTimeoutMillis: parseInt(process.env.DATABASE_POOL_IDLE_TIMEOUT || '30000', 10),
  },
};

let pool: sql.ConnectionPool | null = null;
let connectionPromise: Promise<sql.ConnectionPool> | null = null;

export async function getDbConnection(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    try {
      pool.request();
      return pool;
    } catch {
      pool = null;
      connectionPromise = null;
    }
  }

  if (pool && !pool.connected) {
    try {
      await pool.close();
    } catch {
      // ignore
    }
    pool = null;
    connectionPromise = null;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      console.log(`Attempting to connect to SQL Server: ${config.server}`);
      const newPool = new sql.ConnectionPool(config);
      await newPool.connect();
      pool = newPool;
      console.log('Connected to SQL Server');
      newPool.on('error', (err) => {
        console.error('Database connection pool error:', err);
        pool = null;
        connectionPromise = null;
      });
      return pool!;
    } catch (error) {
      console.error('Database connection error:', error);
      pool = null;
      connectionPromise = null;
      throw error;
    }
  })();

  return connectionPromise;
}

export async function closeDbConnection(): Promise<void> {
  if (!pool) return;
  const p = pool;
  pool = null;
  connectionPromise = null;
  try {
    await p.close();
    console.log('Disconnected from SQL Server');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Cannot close a pool while it is connecting')) {
      console.warn('Error closing pool:', message);
    }
  }
}
