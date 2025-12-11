import { z } from 'zod';
import { ethers } from 'ethers';
import { sanitizeEmail, containsScriptTags } from '../utils/sanitize';

const ethereumAddressSchema = z.string().refine(
  (val) => ethers.isAddress(val),
  { message: 'Invalid Ethereum address' }
);

const milestoneSchema = z.object({
  amount: z.union([
    z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a valid number string'),
    z.number().positive('Amount must be positive')
  ]),
  description: z.string().min(1, 'Milestone description is required').max(500, 'Description too long'),
  completed: z.boolean().optional().default(false),
  completedAt: z.number().optional()
});

const metadataSchema = z.object({
  title: z.string().max(200, 'Title too long').optional(),
  description: z.string().max(2000, 'Description too long').optional(),
  category: z.string().optional(),
  milestones: z.array(milestoneSchema).optional(),
  images: z.array(z.string().url('Invalid image URL')).optional(),
  tags: z.array(z.string().max(50)).optional()
}).refine(
  (val) => {
    const jsonStr = JSON.stringify(val);
    return !jsonStr.match(/<script|javascript:|on\w+\s*=/i);
  },
  { message: 'Invalid characters detected in metadata' }
);

export const createEscrowSchema = z.object({
  body: z.object({
    seller: ethereumAddressSchema,
    amount: z.union([
      z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a valid number string'),
      z.number().positive('Amount must be positive')
    ]),
    tokenAddress: ethereumAddressSchema.optional().or(z.literal('')),
    buyerEmail: z.string().email('Invalid buyer email').optional().transform((val) => {
      if (!val) return undefined;
      return sanitizeEmail(val);
    }),
    sellerEmail: z.string().email('Invalid seller email').optional().transform((val) => {
      if (!val) return undefined;
      return sanitizeEmail(val);
    }),
    metadata: metadataSchema.optional(),
    conversationContext: z.object({}).passthrough().optional().refine(
      (val) => {
        if (!val) return true;
        const jsonStr = JSON.stringify(val);
        return !jsonStr.match(/<script|javascript:|on\w+\s*=/i);
      },
      { message: 'Invalid characters detected in conversation context' }
    )
  }).transform((data) => {
    const metadataHash = data.metadata 
      ? ethers.id(JSON.stringify(data.metadata))
      : ethers.id(JSON.stringify({}));
    
    return {
      ...data,
      metadataHash,
      tokenAddress: data.tokenAddress || ethers.ZeroAddress
    };
  })
});

export const releaseEscrowSchema = z.object({
  params: z.object({
    escrowId: z.string().regex(/^\d+$/, 'Escrow ID must be a number')
  }),
  body: z.object({
    milestoneIndex: z.number().int().min(0).optional()
  })
});

export const refundEscrowSchema = z.object({
  params: z.object({
    escrowId: z.string().regex(/^\d+$/, 'Escrow ID must be a number')
  })
});

export const disputeEscrowSchema = z.object({
  params: z.object({
    escrowId: z.string().regex(/^\d+$/, 'Escrow ID must be a number')
  }),
  body: z.object({
    reason: z.string()
      .min(1, 'Dispute reason is required')
      .max(1000, 'Reason too long')
      .refine((val) => !containsScriptTags(val), {
        message: 'Invalid characters detected in dispute reason'
      }),
    evidence: z.array(z.string().max(500)).optional()
  })
});

export const getEscrowSchema = z.object({
  params: z.object({
    escrowId: z.string().regex(/^\d+$/, 'Escrow ID must be a number')
  })
});

