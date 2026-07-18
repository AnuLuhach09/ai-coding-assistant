console.log('>>> index.ts loaded, starting boot sequence');
import dotenv from 'dotenv';
// Load environment variables first
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { logger } from './utils/logger';
import { connectRedis } from './config/redis';
import { initChroma } from './config/chroma';
import { errorHandler } from './middlewares/errorHandler';

import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import chatRoutes from './routes/chat.routes';
import fileRoutes from './routes/file.routes';
import githubRoutes from './routes/github.routes';
import profileRoutes from './routes/profile.routes';
import settingsRoutes from './routes/settings.routes';
import analysisRoutes from './routes/analysis.routes';

const app = express();
app.options('*', (req, res) => {
  console.log("========== OPTIONS ==========");
  console.log(req.originalUrl);
  console.log(req.headers.origin);

  res.header("Access-Control-Allow-Origin", process.env.CORS_ORIGIN!);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

  return res.sendStatus(204);
});
const port = process.env.PORT || 5000;

// Security and utility middlewares
app.use(helmet());

// CORS_ORIGIN accepts a comma-separated list of allowed origins, e.g.
// "https://my-frontend.up.railway.app,http://localhost:3000". Falls back to
// localhost:3000 for local development if not set.
const allowedOrigins = (
  process.env.CORS_ORIGIN || "http://localhost:3000"
)
.split(",")
.map(origin => origin.trim());

app.use(cors({
    origin: function(origin, callback) {

        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        console.log("Blocked Origin:", origin);

        callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET","POST","PUT","DELETE","OPTIONS"],
    allowedHeaders: ["Content-Type","Authorization"]
}));

app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Morgan http request logging piped to Winston
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message: string) => logger.http(message.trim()),
    },
  })
);


app.use((req, res, next) => {
  console.log(req.method, req.url, req.headers.origin);
  next();
});
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/analysis', analysisRoutes);

// Global Error Handler Middleware
app.use(errorHandler);

// Start Server
const startServer = () => {
  // Start accepting HTTP traffic (and /health checks) immediately.
  // Redis and Chroma are optional dependencies — connect them in the
  // background so a slow/unreachable instance never delays or blocks
  // the health check from coming online.
  app.listen(port, () => {
    logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
  });

  connectRedis().catch((error) => {
    logger.error(`Redis connection failed in background: ${error}`);
  });

  initChroma().catch((error) => {
    logger.error(`Chroma connection failed in background: ${error}`);
  });
};

startServer();