import { Response, NextFunction } from 'express';
import { settingRepository } from '../repositories/setting.repository';
import { AuthRequest } from '../interfaces/auth';
import { sendSuccess, sendError } from '../utils/response';

export class SettingsController {
  async getSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      let settings = await settingRepository.findByUserId(userId);

      if (!settings) {
        settings = await settingRepository.create({
          userId,
        });
      }

      return sendSuccess(res, { settings });
    } catch (error) {
      return next(error);
    }
  }

  async updateSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { aiProvider, aiModel, temperature, maxTokens, isStreaming, isNotificationsEnabled } = req.body;

      if (aiProvider && aiProvider !== 'groq') {
        return sendError(res, 'BAD_REQUEST', 'This AI provider is currently unavailable. Please use Groq.', 400);
      }

      const updated = await settingRepository.update(userId, {
        aiProvider,
        aiModel,
        temperature: temperature !== undefined ? parseFloat(temperature) : undefined,
        maxTokens: maxTokens !== undefined ? parseInt(maxTokens) : undefined,
        isStreaming,
        isNotificationsEnabled,
      });

      return sendSuccess(res, { settings: updated });
    } catch (error) {
      return next(error);
    }
  }
}

export const settingsController = new SettingsController();
