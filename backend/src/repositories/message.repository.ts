import { prisma } from '../config/db';
import { Message, Prisma } from '@prisma/client';

export class MessageRepository {
  async findById(id: string): Promise<Message | null> {
    return prisma.message.findUnique({
      where: { id },
    });
  }

  async create(data: Prisma.MessageUncheckedCreateInput): Promise<Message> {
    return prisma.message.create({
      data,
    });
  }

  async update(id: string, data: Prisma.MessageUpdateInput): Promise<Message> {
    return prisma.message.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Message> {
    return prisma.message.delete({
      where: { id },
    });
  }
}
export const messageRepository = new MessageRepository();
