import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const prisma = {
  $connect: async () => {
    await pool.query('SELECT 1');
  },
  $disconnect: async () => {
    await pool.end();
  },
};

export default prisma;
