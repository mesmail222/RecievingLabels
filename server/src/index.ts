import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { labelsRouter } from './routes/labels';
import { BODY_SIZE_LIMIT, DEFAULT_ALLOWED_ORIGINS } from './config/constants';

// Load server/.env before reading PORT
const serverEnv = path.resolve(__dirname, '../.env');
if (fs.existsSync(serverEnv)) {
  dotenv.config({ path: serverEnv });
}

const app = express();
const PORT = parseInt(process.env.PORT || '3011', 10);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : DEFAULT_ALLOWED_ORIGINS;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: BODY_SIZE_LIMIT }));

app.use('/api/labels', labelsRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'MO Receiving Labels API is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (_req, res) => {
  res.json({
    message: 'MO Receiving Labels API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      morningLabels: '/api/labels/morning',
    },
  });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`MO Receiving Labels API listening on http://127.0.0.1:${PORT}`);
});
