import { Request, Response } from 'express';
import { Waitlist } from '../models/Waitlist';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware';
import { ApiResponse } from '../types';
import { sanitizeEmail, sanitizeString, containsScriptTags } from '../utils/sanitize';
import { emailService } from '../services/EmailService';

export class WaitlistController {
  static joinWaitlist = asyncHandler(async (req: Request, res: Response) => {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    if (containsScriptTags(email) || (name && containsScriptTags(name))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid characters detected in input'
      });
    }

    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedName = name ? sanitizeString(name) : undefined;

    const existingEntry = await Waitlist.findOne({ email: sanitizedEmail });
    if (existingEntry) {
      return res.status(200).json({
        success: true,
        message: 'You are already on the waitlist',
        data: {
          email: existingEntry.email,
          name: existingEntry.name,
          joinedAt: existingEntry.joinedAt
        }
      });
    }

    const waitlistEntry = new Waitlist({
      email: sanitizedEmail,
      name: sanitizedName,
      joinedAt: new Date()
    });

    await waitlistEntry.save();

    const emailSent = await emailService.sendWaitlistConfirmation(waitlistEntry.email, waitlistEntry.name);
    
    if (emailSent) {
      waitlistEntry.notified = true;
      waitlistEntry.notifiedAt = new Date();
      await waitlistEntry.save();
      logger.info('Waitlist entry marked as notified', { email: sanitizedEmail });
    } else {
      logger.warn('Waitlist entry created but email notification failed', { email: sanitizedEmail });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Successfully joined the waitlist',
      data: {
        email: waitlistEntry.email,
        name: waitlistEntry.name,
        joinedAt: waitlistEntry.joinedAt,
        emailSent
      }
    };

    logger.info('New waitlist signup', { email: sanitizedEmail, name: sanitizedName, emailSent });

    res.status(201).json(response);
  });

  static getWaitlistEntry = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.params;
    const sanitizedEmail = sanitizeEmail(email);

    const entry = await Waitlist.findOne({ email: sanitizedEmail });

    if (!entry) {
      return res.status(404).json({
        success: false,
        error: 'Email not found on waitlist'
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        email: entry.email,
        name: entry.name,
        joinedAt: entry.joinedAt,
        notified: entry.notified
      }
    };

    res.status(200).json(response);
  });

  static getAllWaitlist = asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const entries = await Waitlist.find()
      .sort({ joinedAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Waitlist.countDocuments();

    const response: ApiResponse = {
      success: true,
      data: {
        entries: entries.map(entry => ({
          email: entry.email,
          name: entry.name,
          joinedAt: entry.joinedAt,
          notified: entry.notified
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    };

    res.status(200).json(response);
  });
}
