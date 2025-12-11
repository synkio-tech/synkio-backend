import { z } from 'zod';
import { FeedbackChannel } from '../types';
import { sanitizeString, sanitizeEmail, containsScriptTags } from '../utils/sanitize';

export const createFeedbackSchema = z.object({
  body: z.object({
    userEmail: z.union([
      z.string().email(),
      z.literal(''),
      z.undefined()
    ]).optional().transform((val) => {
      if (!val || val === '') return undefined;
      return sanitizeEmail(val);
    }),
    message: z.string()
      .trim()
      .min(1, 'Feedback message is required')
      .max(2000, 'Feedback message must be less than 2000 characters')
      .refine((val) => !containsScriptTags(val), {
        message: 'Feedback message contains invalid content'
      })
      .transform((val) => sanitizeString(val)),
    rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5').optional(),
    channel: z.nativeEnum(FeedbackChannel).optional()
  })
});

export const updateFeedbackStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Feedback ID is required')
  }),
  body: z.object({
    status: z.enum(['new', 'reviewed', 'resolved', 'archived'], {
      errorMap: () => ({ message: 'Valid status is required (new, reviewed, resolved, archived)' })
    })
  })
});

export const getFeedbackByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Feedback ID is required')
  })
});

export const getAllFeedbackSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => {
      if (!val) return 1;
      const parsed = parseInt(val, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }),
    limit: z.string().optional().transform((val) => {
      if (!val) return 50;
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed < 1) return 50;
      return parsed > 100 ? 100 : parsed;
    }),
    status: z.enum(['new', 'reviewed', 'resolved', 'archived']).optional(),
    channel: z.nativeEnum(FeedbackChannel).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'status', 'channel', 'rating', 'userEmail']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
  })
});

