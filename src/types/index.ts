import { Request, Response, NextFunction } from 'express';

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
