import OpenAI from 'openai';
import axios from 'axios';
import { logger } from '../utils/logger';

function humanizeAIError(raw: string): string {
  if (raw.includes('quota') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return 'API quota exceeded. Please check your provider account limits.';
  }
  if (raw.includes('UNAUTHENTICATED') || raw.includes('invalid authentication') || raw.includes('401') || raw.includes('API_KEY_INVALID') || raw.includes('User not found')) {
    return 'Invalid or expired API key. Please check your API key settings.';
  }
  if (raw === 'AggregateError' || raw.includes('ECONNREFUSED') || raw.includes('connect ECONNREFUSED')) {
    return 'Could not connect to the AI provider. If using Ollama, make sure it is installed and running.';
  }
  return raw.split('\n')[0];
}

export class AIService {
  private getOpenAIClient(provider: string) {
    const key = this.getApiKey(provider);
    if (!key) {
      throw new Error(`API key for provider ${provider} is not configured.`);
    }

    if (provider === 'groq') {
      return new OpenAI({
        apiKey: key,
        baseURL: 'https://api.groq.com/openai/v1',
      });
    }
    throw new Error(`Unsupported provider: ${provider}`);
  }

  private getApiKey(provider: string): string | undefined {
    switch (provider) {
      case 'groq':
        return process.env.GROQ_API_KEY;
      default:
        return undefined;
    }
  }

  async chat(
    provider: string,
    model: string,
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    temperature: number = 0.7,
    maxTokens: number = 2048
  ): Promise<string> {
    try {
      if (provider === 'groq') {
        try {
          const client = this.getOpenAIClient(provider);
          const response = await client.chat.completions.create({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
          });
          return response.choices[0]?.message?.content || '';
        } catch (err: any) {
          throw new Error(humanizeAIError(err.message || err));
        }
      }

      if (provider === 'ollama') {
        try {
          const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
          const response = await axios.post(`${ollamaUrl}/api/chat`, {
            model,
            messages,
            options: {
              temperature,
              num_predict: maxTokens,
            },
            stream: false,
          });
          return response.data?.message?.content || '';
        } catch (err: any) {
          throw new Error('Ollama is not running. Please install and start Ollama at https://ollama.com, then run: ollama pull ' + model);
        }
      }

      throw new Error(`Unsupported provider: ${provider}`);
    } catch (error: any) {
      logger.error(`AI Completion error for provider ${provider}: ${error.message || error}`);
      throw new Error(`AI model error: ${error.message || error}`);
    }
  }

  async streamChat(
    provider: string,
    model: string,
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    temperature: number = 0.7,
    maxTokens: number = 2048,
    onChunk: (text: string) => void
  ): Promise<void> {
    try {
      if (provider === 'groq') {
        try {
          const client = this.getOpenAIClient(provider);
          const stream = await client.chat.completions.create({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: true,
          });

          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              onChunk(content);
            }
          }
          return;
        } catch (err: any) {
          throw new Error(humanizeAIError(err.message || err));
        }
      }

      if (provider === 'ollama') {
        const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
        let response;
        try {
          response = await axios.post(
            `${ollamaUrl}/api/chat`,
            {
              model,
              messages,
              options: {
                temperature,
                num_predict: maxTokens,
              },
              stream: true,
            },
            { responseType: 'stream' }
          );
        } catch (ollamaErr: any) {
          throw new Error('Ollama is not running. Please install and start Ollama at https://ollama.com, then run: ollama pull ' + model);
        }

        return new Promise<void>((resolve, reject) => {
          response.data.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n').filter(Boolean);
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.message?.content) {
                  onChunk(parsed.message.content);
                }
              } catch (e) {
                // Ignore parsing errors for partial lines
              }
            }
          });

          response.data.on('end', () => resolve());
          response.data.on('error', (err: any) => reject(new Error('Ollama is not running. Please install and start Ollama at https://ollama.com')));
        });
      }

      throw new Error(`Unsupported streaming provider: ${provider}`);
    } catch (error: any) {
      logger.error(`AI Streaming error for provider ${provider}: ${error.message || error}`);
      throw new Error(`AI model streaming error: ${error.message || error}`);
    }
  }
}

export const aiService = new AIService();
