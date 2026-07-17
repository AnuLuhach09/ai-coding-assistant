import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { logger } from '../utils/logger';

export class AIService {
  private getOpenAIClient(provider: string) {
    const key = this.getApiKey(provider);
    if (!key) {
      throw new Error(`API key for provider ${provider} is not configured.`);
    }

    if (provider === 'openai') {
      return new OpenAI({ apiKey: key });
    } else if (provider === 'groq') {
      return new OpenAI({
        apiKey: key,
        baseURL: 'https://api.groq.com/openai/v1',
      });
    } else if (provider === 'openrouter') {
      return new OpenAI({
        apiKey: key,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Enterprise AI Coding Assistant',
        },
      });
    }
    throw new Error(`Unsupported OpenAI-compatible provider: ${provider}`);
  }

  private getApiKey(provider: string): string | undefined {
    switch (provider) {
      case 'openai':
        return process.env.OPENAI_API_KEY;
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY;
      case 'gemini':
        return process.env.GEMINI_API_KEY;
      case 'groq':
        return process.env.GROQ_API_KEY;
      case 'openrouter':
        return process.env.OPENROUTER_API_KEY;
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
      if (provider === 'openai' || provider === 'groq' || provider === 'openrouter') {
        const client = this.getOpenAIClient(provider);
        const response = await client.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        });
        return response.choices[0]?.message?.content || '';
      }

      if (provider === 'anthropic') {
        const key = this.getApiKey('anthropic');
        if (!key) throw new Error('Anthropic API key is not configured.');
        const anthropic = new Anthropic({ apiKey: key });

        const systemMessage = messages.find((m) => m.role === 'system')?.content;
        const chatMessages = messages.filter((m) => m.role !== 'system') as any[];

        const response = await anthropic.messages.create({
          model,
          system: systemMessage,
          messages: chatMessages,
          max_tokens: maxTokens,
          temperature,
        });
        const block = response.content[0];
        return block.type === 'text' ? block.text : '';
      }

      if (provider === 'gemini') {
        const key = this.getApiKey('gemini');
        if (!key) throw new Error('Gemini API key is not configured.');
        const genAI = new GoogleGenerativeAI(key);
        const systemMessage = messages.find((m) => m.role === 'system')?.content;
        const geminiModel = genAI.getGenerativeModel({
          model,
          systemInstruction: systemMessage,
        } as any);

        // Convert messages to Gemini format
        const contents = messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          }));

        const response = await geminiModel.generateContent({
          contents,
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        });
        return response.response.text();
      }

      if (provider === 'ollama') {
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
      if (provider === 'openai' || provider === 'groq' || provider === 'openrouter') {
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
      }

      if (provider === 'anthropic') {
        const key = this.getApiKey('anthropic');
        if (!key) throw new Error('Anthropic API key is not configured.');
        const anthropic = new Anthropic({ apiKey: key });

        const systemMessage = messages.find((m) => m.role === 'system')?.content;
        const chatMessages = messages.filter((m) => m.role !== 'system') as any[];

        const stream = await anthropic.messages.create({
          model,
          system: systemMessage,
          messages: chatMessages,
          max_tokens: maxTokens,
          temperature,
          stream: true,
        });

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            onChunk(chunk.delta.text);
          }
        }
        return;
      }

      if (provider === 'gemini') {
        const key = this.getApiKey('gemini');
        if (!key) throw new Error('Gemini API key is not configured.');
        const genAI = new GoogleGenerativeAI(key);
        const systemMessage = messages.find((m) => m.role === 'system')?.content;
        const geminiModel = genAI.getGenerativeModel({
          model,
          systemInstruction: systemMessage,
        } as any);

        const contents = messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          }));

        const result = await geminiModel.generateContentStream({
          contents,
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        });

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            onChunk(text);
          }
        }
        return;
      }

      if (provider === 'ollama') {
        const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
        const response = await axios.post(
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
          response.data.on('error', (err: any) => reject(err));
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
