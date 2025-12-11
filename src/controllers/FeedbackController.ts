import { Request, Response } from 'express';
import { z } from 'zod';
import { Feedback } from '../models/Feedback';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware';
import { ApiResponse, FeedbackChannel } from '../types';
import { createFeedbackSchema, updateFeedbackStatusSchema, getAllFeedbackSchema, getFeedbackByIdSchema } from '../validations/feedback';
import { sanitizeEmail, sanitizeString } from '../utils/sanitize';

export class FeedbackController {
  static createFeedback = asyncHandler(async (req: Request, res: Response) => {
    try {
      const validated = createFeedbackSchema.parse({ body: req.body });
      const { userEmail, message, rating, channel } = validated.body;

      const feedback = new Feedback({
        userEmail: userEmail ? sanitizeEmail(userEmail) : undefined,
        message: sanitizeString(message.trim()),
        rating,
        channel: channel || FeedbackChannel.WEB,
        status: 'new'
      });

      await feedback.save();

      const response: ApiResponse = {
        success: true,
        message: 'Feedback submitted successfully',
        data: {
          id: feedback._id,
          userEmail: feedback.userEmail,
          message: feedback.message,
          rating: feedback.rating,
          channel: feedback.channel,
          status: feedback.status,
          createdAt: feedback.createdAt
        }
      };

      logger.info(`Feedback submitted: ${feedback._id} from ${feedback.channel}${feedback.userEmail ? ` by ${feedback.userEmail}` : ''}`);

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      }
      throw error;
    }
  });

  static getAllFeedback = asyncHandler(async (req: Request, res: Response) => {
    try {
      const validated = getAllFeedbackSchema.parse({ query: req.query });
      const { page, limit, status, channel, sortBy, sortOrder } = validated.query;

      const pageNum = page || 1;
      const limitNum = limit || 50;
      const skip = (pageNum - 1) * limitNum;

      const query: any = {};

      if (status) {
        query.status = status;
      }

      if (channel) {
        query.channel = channel;
      }

      // sortBy is validated to be one of the whitelisted fields, safe to use directly
      const sort: Record<string, 1 | -1> = {
        [sortBy || 'createdAt']: sortOrder === 'asc' ? 1 : -1
      };

      const [feedback, total] = await Promise.all([
        Feedback.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Feedback.countDocuments(query)
      ]);

      const response: ApiResponse = {
        success: true,
        data: {
          feedback,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
          }
        }
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      }
      throw error;
    }
  });

  static getFeedbackById = asyncHandler(async (req: Request, res: Response) => {
    try {
      const validated = getFeedbackByIdSchema.parse({ params: req.params });
      const { id } = validated.params;

      const feedback = await Feedback.findById(id);

      if (!feedback) {
        return res.status(404).json({
          success: false,
          error: 'Feedback not found'
        });
      }

      const response: ApiResponse = {
        success: true,
        data: feedback
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      }
      throw error;
    }
  });

  static updateFeedbackStatus = asyncHandler(async (req: Request, res: Response) => {
    try {
      const validated = updateFeedbackStatusSchema.parse({
        params: req.params,
        body: req.body
      });
      const { id } = validated.params;
      const { status } = validated.body;

      const feedback = await Feedback.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      );

      if (!feedback) {
        return res.status(404).json({
          success: false,
          error: 'Feedback not found'
        });
      }

      const response: ApiResponse = {
        success: true,
        message: 'Feedback status updated successfully',
        data: feedback
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      }
      throw error;
    }
  });

  static getFeedbackStats = asyncHandler(async (req: Request, res: Response) => {
    const [total, byStatus, byChannel, avgRating] = await Promise.all([
      Feedback.countDocuments(),
      Feedback.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Feedback.aggregate([
        {
          $group: {
            _id: '$channel',
            count: { $sum: 1 }
          }
        }
      ]),
      Feedback.aggregate([
        {
          $match: { rating: { $exists: true, $ne: null } }
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const response: ApiResponse = {
      success: true,
      data: {
        total,
        byStatus: byStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>),
        byChannel: byChannel.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>),
        averageRating: avgRating.length > 0 ? avgRating[0].avgRating : null,
        ratedFeedbackCount: avgRating.length > 0 ? avgRating[0].count : 0
      }
    };

    res.status(200).json(response);
  });
}

