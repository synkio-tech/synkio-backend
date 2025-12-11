import { Request, Response } from 'express';
import { Conversation } from '../models/Conversation';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware';
import { ApiResponse } from '../types';
import { sanitizeEmail } from '../utils/sanitize';
import { randomUUID } from 'crypto';
import { getWebSocketService } from '../services/websocket';

export class ConversationController {
  static getConversation = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const conversation = await Conversation.findOne({ conversationId: id });
    
    if (!conversation) {
      return res.status(404).json({ 
        success: false,
        error: 'Conversation not found' 
      });
    }

    const response: ApiResponse = {
      success: true,
      data: conversation
    };

    res.status(200).json(response);
  });

  static createConversation = asyncHandler(async (req: Request, res: Response) => {
    const { userEmail, channel } = req.body;
    
    const sanitizedEmail = sanitizeEmail(userEmail);
    const conversationId = randomUUID();
    
    const conversation = new Conversation({
      conversationId,
      userEmail: sanitizedEmail,
      channel: channel || 'web',
      messages: [],
      context: {}
    });

    await conversation.save();
    
    try {
      const wsService = getWebSocketService();
      if (!wsService) {
        return;
      }
      wsService.notifyUser(sanitizedEmail, 'conversation:created', {
        conversationId,
        channel: conversation.channel
        });
    } catch (error) {
      logger.warn('WebSocket service not available for notification');
    }
    
    const response: ApiResponse = {
      success: true,
      message: 'Conversation created successfully',
      data: conversation
    };
    
    res.status(201).json(response);
  });

  static saveMessage = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { role, content, toolCalls } = req.body;
    
    const conversation = await Conversation.findOne({ conversationId: id });
    
    if (!conversation) {
      return res.status(404).json({ 
        success: false,
        error: 'Conversation not found' 
      });
    }
    
    const newMessage = {
      role,
      content,
      timestamp: new Date(),
      toolCalls: toolCalls || []
    };
    
    conversation.messages.push(newMessage);
    await conversation.save();

    try {
      const wsService = getWebSocketService();
      if (wsService) {
      wsService.notifyConversation(id, 'message:new', {
        message: newMessage,
        conversationId: id,
        userEmail: conversation.userEmail
      });

      wsService.notifyUser(conversation.userEmail, 'message:new', {
        message: newMessage,
        conversationId: id
      });
    }
    } catch (error) {
      logger.warn('WebSocket service not available for notification');
    }

    const response: ApiResponse = {
      success: true,
      message: 'Message saved successfully',
      data: conversation
    };

    res.status(200).json(response);
  });

  static updateContext = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { context } = req.body;
    
    const conversation = await Conversation.findOne({ conversationId: id });
    
    if (!conversation) {
      return res.status(404).json({ 
        success: false,
        error: 'Conversation not found' 
      });
    }
    
    conversation.context = {
      ...conversation.context,
      ...context
    };
    
    await conversation.save();

    try {
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.notifyConversation(id, 'context:updated', {
          context: conversation.context,
          conversationId: id
        });
      }
    } catch (error) {
      logger.warn('WebSocket service not available for notification');
    }

    const response: ApiResponse = {
      success: true,
      message: 'Context updated successfully',
      data: conversation
    };

    res.status(200).json(response);
  });

  static getConversationHistory = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { limit = 20 } = req.query;
    
    const conversation = await Conversation.findOne({ conversationId: id });
    
    if (!conversation) {
      return res.status(404).json({ 
        success: false,
        error: 'Conversation not found' 
      });
    }
    
    const messages = conversation.messages.slice(-Number(limit));

    const response: ApiResponse = {
      success: true,
      data: {
        conversationId: conversation.conversationId,
        messages,
        context: conversation.context
      }
    };

    res.status(200).json(response);
  });
}
