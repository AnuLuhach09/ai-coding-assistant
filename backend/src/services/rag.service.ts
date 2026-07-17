import { chromaClient, isChromaEnabled } from '../config/chroma';
import OpenAI from 'openai';
import { logger } from '../utils/logger';

export class RAGService {
  private openai: OpenAI | null = null;

  constructor() {
    const key = process.env.OPENAI_API_KEY;
    if (key) {
      this.openai = new OpenAI({ apiKey: key });
    }
  }

  private async getEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      // Fallback pseudo-embedding if key not provided, length 1536
      logger.warn('OpenAI API key missing. Generating dummy embeddings for RAG.');
      const arr = new Array(1536).fill(0);
      for (let i = 0; i < text.length && i < 1536; i++) {
        arr[i] = text.charCodeAt(i) / 255.0;
      }
      return arr;
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.replace(/\n/g, ' '),
      });
      return response.data[0].embedding;
    } catch (error: any) {
      logger.error(`Error generating embedding: ${error.message || error}`);
      throw new Error(`Embedding generator error: ${error.message || error}`);
    }
  }

  private chunkText(text: string, chunkSize: number = 1000, chunkOverlap: number = 200): string[] {
    const chunks: string[] = [];
    let currentIndex = 0;

    if (text.length <= chunkSize) {
      return [text];
    }

    while (currentIndex < text.length) {
      let endIndex = currentIndex + chunkSize;
      if (endIndex > text.length) {
        endIndex = text.length;
      }

      chunks.push(text.slice(currentIndex, endIndex));
      currentIndex += chunkSize - chunkOverlap;
    }

    return chunks;
  }

  async indexFile(projectId: string, fileId: string, filePath: string, fileContent: string): Promise<void> {
    if (!isChromaEnabled || !chromaClient) {
      logger.debug('Chroma disabled — skipping RAG indexing.');
      return;
    }

    try {
      const collectionName = `project_${projectId.replace(/-/g, '_')}`;
      let collection;

      try {
        collection = await chromaClient.getOrCreateCollection({
          name: collectionName,
        });
      } catch (err) {
        logger.error(`Error fetching collection: ${err}`);
        throw err;
      }

      const chunks = this.chunkText(fileContent);
      const ids: string[] = [];
      const embeddings: number[][] = [];
      const metadatas: any[] = [];
      const documents: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await this.getEmbedding(chunk);

        ids.push(`${fileId}_chunk_${i}`);
        embeddings.push(embedding);
        metadatas.push({
          fileId,
          filePath,
          projectId,
          chunkIndex: i,
        });
        documents.push(chunk);
      }

      if (ids.length > 0) {
        await collection.add({
          ids,
          embeddings,
          metadatas,
          documents,
        });
        logger.info(`Indexed file ${filePath} (${chunks.length} chunks) in project ${projectId}`);
      }
    } catch (error: any) {
      logger.error(`Failed to index file ${filePath}: ${error.message || error}`);
    }
  }

  async querySimilarity(projectId: string, queryText: string, limit: number = 5): Promise<{ content: string; filePath: string }[]> {
    if (!isChromaEnabled || !chromaClient) {
      return [];
    }

    try {
      const collectionName = `project_${projectId.replace(/-/g, '_')}`;
      let collection;

      try {
        collection = await chromaClient.getCollection({
          name: collectionName,
          embeddingFunction: undefined as any,
        });
      } catch (e) {
        // Collection doesn't exist yet, return empty list
        return [];
      }

      const queryEmbedding = await this.getEmbedding(queryText);
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
      });

      const matched: { content: string; filePath: string }[] = [];
      if (results && results.documents && results.documents[0]) {
        const docs = results.documents[0];
        const metas = results.metadatas[0];

        for (let i = 0; i < docs.length; i++) {
          if (docs[i]) {
            matched.push({
              content: docs[i] as string,
              filePath: (metas[i] as any)?.filePath || 'unknown',
            });
          }
        }
      }
      return matched;
    } catch (error: any) {
      logger.error(`Failed to query RAG: ${error.message || error}`);
      return [];
    }
  }

  async deleteProjectIndex(projectId: string): Promise<void> {
    if (!isChromaEnabled || !chromaClient) {
      return;
    }

    try {
      const collectionName = `project_${projectId.replace(/-/g, '_')}`;
      await chromaClient.deleteCollection({ name: collectionName });
      logger.info(`Deleted collection index ${collectionName}`);
    } catch (error) {
      // Ignore if doesn't exist
    }
  }
}

export const ragService = new RAGService();
