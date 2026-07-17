import { createClient } from 'redis';
import { logger } from '../utils/logger';

// Redis is OPTIONAL. If REDIS_URL is not set, the app simply skips
// connecting and continues to run — nothing else in the codebase currently
// depends on redisClient being connected. This avoids crash-loops on
// platforms like Railway when no Redis plugin has been attached yet.
const redisUrl = process.env.REDIS_URL;

export let isRedisEnabled = Boolean(redisUrl);

const MAX_RETRIES = 5;

export const redisClient = createClient({
  url: redisUrl || 'redis://localhost:6379',
  socket: {
    connectTimeout: 5000,
    // Stop retrying after a handful of attempts instead of retrying forever
    // (the default behavior), which otherwise spams the logs and keeps a
    // dangling connection alive when Redis is unreachable.
    reconnectStrategy: (retries) => {
      if (retries >= MAX_RETRIES) {
        logger.error('Redis: giving up after repeated failed reconnect attempts.');
        return new Error('Redis unavailable — giving up reconnecting.');
      }
      return Math.min(retries * 200, 2000);
    },
  },
});

redisClient.on('error', (err) => {
  logger.error(`Redis client error: ${err}`);
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis server');
});

export const connectRedis = async (): Promise<void> => {
  if (!isRedisEnabled) {
    logger.warn('REDIS_URL not set — skipping Redis connection.');
    return;
  }

  try {
    await redisClient.connect();
  } catch (error) {
    // Never crash the app because Redis is unreachable at boot.
    logger.error(`Failed to connect to Redis, continuing without it: ${error}`);
    isRedisEnabled = false;
  }
};
