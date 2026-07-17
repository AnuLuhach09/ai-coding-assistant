import { Response, NextFunction } from 'express';
import { AuthRequest } from '../interfaces/auth';
import { sendSuccess, sendError } from '../utils/response';
import { aiService } from '../services/ai.service';
import { settingRepository } from '../repositories/setting.repository';
import { logger } from '../utils/logger';

export class AnalysisController {
  async analyzeCode(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { action, code, language, mode, testFramework } = req.body;

      if (!action || !code) {
        return sendError(res, 'BAD_REQUEST', 'Action and code content are required', 400);
      }

      // Get user settings for model selection
      let settings = await settingRepository.findByUserId(req.user!.id);
      if (!settings) {
        settings = {
          id: '',
          userId: req.user!.id,
          aiProvider: 'openai',
          aiModel: 'gpt-4o',
          temperature: 0.5,
          maxTokens: 3000,
          isStreaming: true,
          isNotificationsEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      // Design specific system instructions for each action
      let actionInstruction = '';

      switch (action) {
        case 'explain':
          actionInstruction = `Provide a detailed line-by-line explanation of the code, detailing function purposes, parameters, complexity (Big O), and logical flow. Tailor the tone and detail level to a user who is at the: ${mode || 'intermediate'} level.`;
          break;
        case 'debug':
          actionInstruction = `Analyze the code for syntax issues, logic errors, runtime bugs, and security risks. Provide a list of identified bugs along with corrected code.`;
          break;
        case 'optimize':
          actionInstruction = `Examine the code and propose optimizations for performance (faster algorithms, better time complexity) and resource efficiency (memory usage), following standard code styling rules. Provide optimized code along with comparison explanations.`;
          break;
        case 'review':
          actionInstruction = `Perform a code review following industry standards. Check code structure, readability, naming conventions, architecture principles, and maintainability. Rate the code quality.`;
          break;
        case 'tests':
          actionInstruction = `Generate robust unit tests for the provided code. Use the framework: ${testFramework || 'Vitest/Jest'} for the programming language: ${language || 'TypeScript'}. Cover edge cases, success paths, and failure models.`;
          break;
        case 'doc':
          actionInstruction = `Generate standard documentation for the code: API specs, function block descriptions, class variables docstrings, and a concise README markdown file.`;
          break;
        default:
          return sendError(res, 'BAD_REQUEST', `Unsupported action: ${action}`, 400);
      }

      const systemPrompt = `You are a Senior Software Engineer and AI Assistant.
${actionInstruction}
Respond in clear, professional developer language. Formulate your response in Markdown. Wrap code blocks in standard triple backticks with the correct programming language tag.`;

      const userPrompt = `Language: ${language || 'Unspecified'}
Code:
\`\`\`${language || ''}
${code}
\`\`\``;

      if (settings.isStreaming) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        try {
          await aiService.streamChat(
            settings.aiProvider,
            settings.aiModel,
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            settings.temperature,
            settings.maxTokens,
            (chunk: string) => {
              res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
            }
          );
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
        } catch (streamErr: any) {
          logger.error(`Error during code action streaming: ${streamErr.message}`);
          res.write(`data: ${JSON.stringify({ error: streamErr.message || 'Stream broke' })}\n\n`);
          res.end();
        }
      } else {
        const result = await aiService.chat(
          settings.aiProvider,
          settings.aiModel,
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          settings.temperature,
          settings.maxTokens
        );

        return sendSuccess(res, { result });
      }
    } catch (error) {
      return next(error);
    }
  }
}

export const analysisController = new AnalysisController();
