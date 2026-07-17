import { ChromaClient } from 'chromadb';
import { logger } from '../utils/logger';

// Chroma is OPTIONAL. If CHROMA_URL is not set, RAG/embedding features are
// silently disabled and the rest of the app (auth, projects, chat, files)
// works normally. This lets the app boot on platforms like Railway where
// a ChromaDB instance may not be provisioned.
const chromaUrl = process.env.CHROMA_URL;

export let isChromaEnabled = Boolean(chromaUrl);

export const chromaClient = isChromaEnabled
  ? new ChromaClient({ path: chromaUrl })
  : null;

// Don't let a slow/unreachable Chroma host hang server startup.
const CONNECT_TIMEOUT_MS = 5000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Chroma connection timed out after ${ms}ms`)), ms)
    ),
  ]);
};

export const initChroma = async (): Promise<void> => {
  if (!isChromaEnabled || !chromaClient) {
    logger.warn('CHROMA_URL not set — Chroma/RAG features are disabled.');
    return;
  }

  try {
    const version = await withTimeout(chromaClient.version(), CONNECT_TIMEOUT_MS);
    logger.info(`Connected to ChromaDB, version: ${version}`);
  } catch (error) {
    // Never crash the app because Chroma is unreachable — just disable RAG
    // for this process. indexFile/querySimilarity in rag.service already
    // check isChromaEnabled before touching chromaClient.
    logger.error(`Failed to connect to ChromaDB, disabling RAG features: ${error}`);
    isChromaEnabled = false;
  }
};
