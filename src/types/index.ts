import { Request, Response, NextFunction } from 'express';

/**
 * Channel Enum - Centralized channel definitions
 * 
 * To add a new channel:
 * 1. Add the channel to the Channel enum below
 * 2. Add it to ACTIVE_CHANNELS if it should be enabled
 * 3. Update models/schemas that use channel enums (Conversation, Transaction)
 * 
 * To remove a channel:
 * 1. Remove from Channel enum
 * 2. Remove from ACTIVE_CHANNELS
 * 3. Update any channel-specific logic
 */
export enum Channel {
  WEB = 'web',
  WHATSAPP = 'whatsapp',
  FARCASTER = 'farcaster'
}

export const ACTIVE_CHANNELS = [Channel.WEB, Channel.WHATSAPP] as const

export function isActiveChannel(channel: string): boolean {
  return ACTIVE_CHANNELS.includes(channel as Channel)
}

export enum FeedbackChannel {
  WEB = 'web',
  WHATSAPP = 'whatsapp'
}

export enum KYCStatus {
  NOT_STARTED = 'not_started',
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export enum PrivacyLevel {
  PUBLIC = 'public',
  PRIVATE = 'private',
  FRIENDS = 'friends'
}

export enum Chain {
  ETHEREUM = 'ethereum',
  BASE = 'base',
  SOLANA = 'solana'
}

export interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
    walletAddress: string;

  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface VendorSearchQuery extends PaginationQuery {
  category?: string;
  minReputation?: number;
  location?: string;
  isVerified?: boolean;
}

export interface TransactionQuery extends PaginationQuery {
  status?: string;
  type?: 'marketplace' | 'service';
  buyerEmail?: string;
  sellerEmail?: string;
}
