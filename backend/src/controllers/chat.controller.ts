import { Response, NextFunction } from 'express';
import { chatRepository } from '../repositories/chat.repository';
import { messageRepository } from '../repositories/message.repository';
import { projectRepository } from '../repositories/project.repository';
import { settingRepository } from '../repositories/setting.repository';
import { AuthRequest } from '../interfaces/auth';
import { sendSuccess, sendError } from '../utils/response';
import { ragService } from '../services/rag.service';
import { aiService } from '../services/ai.service';
import { logger } from '../utils/logger';

export class ChatController {
  async getProjectChats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params;
      const project = await projectRepository.findById(projectId);

      if (!project || project.userId !== req.user!.id) {
        return sendError(res, 'FORBIDDEN', 'Access denied', 403);
      }

      const chats = await chatRepository.findAllByProjectId(projectId);
      return sendSuccess(res, { chats });
    } catch (error) {
      return next(error);
    }
  }

  async createChat(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params;
      const { title } = req.body;

      const project = await projectRepository.findById(projectId);
      if (!project || project.userId !== req.user!.id) {
        return sendError(res, 'FORBIDDEN', 'Access denied', 403);
      }

      const chat = await chatRepository.create({
        title: title || 'New Conversation',
        project: { connect: { id: projectId } },
        user: { connect: { id: req.user!.id } },
      });

      return sendSuccess(res, { chat }, 201);
    } catch (error) {
      return next(error);
    }
  }

  async getMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { chatId } = req.params;
      const chat = await chatRepository.findById(chatId);

      if (!chat || chat.userId !== req.user!.id) {
        return sendError(res, 'FORBIDDEN', 'Access denied', 403);
      }

      return sendSuccess(res, { messages: chat.messages });
    } catch (error) {
      return next(error);
    }
  }

  async sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { chatId } = req.params;
      const { content } = req.body;

      const chat = await chatRepository.findById(chatId);
      if (!chat || chat.userId !== req.user!.id) {
        return sendError(res, 'FORBIDDEN', 'Access denied', 403);
      }

      // Save user message to database
      await messageRepository.create({
        chatId,
        sender: 'USER',
        content,
      });

      // Get user settings
      let settings = await settingRepository.findByUserId(req.user!.id);
      if (!settings) {
        settings = {
          id: '',
          userId: req.user!.id,
          aiProvider: 'openai',
          aiModel: 'gpt-4o',
          temperature: 0.7,
          maxTokens: 2048,
          isStreaming: true,
          isNotificationsEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      // Query ChromaDB vector database (RAG Context)
      const ragChunks = await ragService.querySimilarity(chat.projectId, content, 4);
      let contextPrompt = '';
      if (ragChunks.length > 0) {
        contextPrompt = `\n\n[CONTEXT FROM USER FILES / REPOSITORY]:\n` +
          ragChunks.map((chunk) => `File: ${chunk.filePath}\nContent:\n${chunk.content}`).join('\n---\n') +
          `\n\nRefer to the context above to assist in answering the query accurately if applicable.`;
      }

      // Prepare conversation history for LLM
      const chatHistory = chat.messages.map((msg) => ({
        role: (msg.sender === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: msg.content,
      }));

      // Append new message with context
      chatHistory.push({
        role: 'user',
        content: content + contextPrompt,
      });

      // Append general system prompt
      const systemMessage = {
        role: 'system' as const,
        content: `You are an expert AI Coding Assistant named CodeCoach AI. Assist the user with coding tasks, debugging, explanation, and project structure optimization. Provide clean, maintainable code snippets inside markdown blocks with proper language syntax highlighting.`,
      };

      const messagesForAI = [systemMessage, ...chatHistory];

      if (settings.isStreaming) {
        // SSE connection
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        let accumulatedResponse = '';

        try {
          await aiService.streamChat(
            settings.aiProvider,
            settings.aiModel,
            messagesForAI,
            settings.temperature,
            settings.maxTokens,
            (chunk: string) => {
              accumulatedResponse += chunk;
              res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
            }
          );

          // Save assistant message to database
          const finalMsg = await messageRepository.create({
            chatId,
            sender: 'AI',
            content: accumulatedResponse,
            modelUsed: settings.aiModel,
          });

          res.write(`data: ${JSON.stringify({ done: true, messageId: finalMsg.id })}\n\n`);
          res.end();
        } catch (streamErr: any) {
          logger.error(`Error during chat stream: ${streamErr.message}`);
          res.write(`data: ${JSON.stringify({ error: streamErr.message || 'Stream broke' })}\n\n`);
          res.end();
        }
      } else {
        const reply = await aiService.chat(
          settings.aiProvider,
          settings.aiModel,
          messagesForAI,
          settings.temperature,
          settings.maxTokens
        );

        const aiMsg = await messageRepository.create({
          chatId,
          sender: 'AI',
          content: reply,
          modelUsed: settings.aiModel,
        });

        // Trigger update to the chat's updatedAt field
        await chatRepository.update(chatId, { updatedAt: new Date() });

        return sendSuccess(res, { message: aiMsg });
      }
    } catch (error) {
      return next(error);
    }
  }

  async pinChat(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { chatId } = req.params;
      const { isPinned } = req.body;

      const chat = await chatRepository.findById(chatId);
      if (!chat || chat.userId !== req.user!.id) {
        return sendError(res, 'FORBIDDEN', 'Access denied', 403);
      }

      const updated = await chatRepository.update(chatId, { isPinned });
      return sendSuccess(res, { chat: updated });
    } catch (error) {
      return next(error);
    }
  }

  async editMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { messageId } = req.params;
      const { content } = req.body;

      const message = await messageRepository.findById(messageId);
      if (!message) {
        return sendError(res, 'NOT_FOUND', 'Message not found', 404);
      }

      const chat = await chatRepository.findById(message.chatId);
      if (!chat || chat.userId !== req.user!.id) {
        return sendError(res, 'FORBIDDEN', 'Access denied', 403);
      }

      // Track version history for user messages
      const history = (message.versionHistory as any[]) || [];
      history.push({
        content: message.content,
        editedAt: message.updatedAt,
      });

      const updated = await messageRepository.update(messageId, {
        content,
        versionHistory: history,
      });

      return sendSuccess(res, { message: updated });
    } catch (error) {
      return next(error);
    }
  }

  async deleteMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { messageId } = req.params;
      const message = await messageRepository.findById(messageId);

      if (!message) {
        return sendError(res, 'NOT_FOUND', 'Message not found', 404);
      }

      const chat = await chatRepository.findById(message.chatId);
      if (!chat || chat.userId !== req.user!.id) {
        return sendError(res, 'FORBIDDEN', 'Access denied', 403);
      }

      await messageRepository.delete(messageId);
      return sendSuccess(res, { message: 'Message deleted successfully' });
    } catch (error) {
      return next(error);
    }
  }

  async exportChat(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { chatId } = req.params;
      const chat = await chatRepository.findById(chatId);

      if (!chat || chat.userId !== req.user!.id) {
        return sendError(res, 'FORBIDDEN', 'Access denied', 403);
      }

      const formatted = chat.messages
        .map((m) => `### ${m.sender} (${m.createdAt.toISOString()})\n\n${m.content}`)
        .join('\n\n---\n\n');

      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="chat_export_${chatId}.md"`);
      return res.send(formatted);
    } catch (error) {
      return next(error);
    }
  }
}

export const chatController = new ChatController();
