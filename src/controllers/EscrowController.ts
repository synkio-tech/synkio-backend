import { Request, Response } from 'express';
import { Transaction } from '../models/Transaction';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware';
import { ApiResponse } from '../types';
import { ethers } from 'ethers';
import { sanitizeObject, sanitizeString, sanitizeEmail } from '../utils/sanitize';
import { CreateEscrowDto, ReleaseEscrowDto, RefundEscrowDto, DisputeEscrowDto, GetEscrowDto } from '../dto/escrow.dto';

export class EscrowController {
  constructor(
    private escrowService: any,
    private disputeService: any
  ) {}

  createEscrow = asyncHandler(async (req: Request, res: Response) => {
    const dto = req.body as CreateEscrowDto;
    const { seller, amount, tokenAddress, buyerEmail, sellerEmail, metadata, conversationContext } = dto;
    
    const sanitizedBuyerEmail = sanitizeEmail(buyerEmail);
    const sanitizedSellerEmail = sanitizeEmail(sellerEmail);
    
    const description = metadata?.description || metadata?.title || 'Escrow transaction';
    const milestones = metadata?.milestones || [];
    const metadataHash = metadata 
      ? ethers.id(JSON.stringify(metadata))
      : ethers.id(JSON.stringify({}));
    const finalTokenAddress = tokenAddress || ethers.ZeroAddress;
    
    const tx = await this.escrowService.createEscrow(
      seller,
      description,
      metadataHash,
      milestones,
      finalTokenAddress,
      amount
    );
    
    const receipt = await tx.wait();
    
    if (!receipt || !receipt.logs || receipt.logs.length === 0) {
      logger.error('Transaction receipt has no logs');
      throw new Error('Failed to extract escrow ID from transaction receipt');
    }
    
    const escrowCreatedEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = this.escrowService.contract.interface.parseLog(log);
        return parsed?.name === 'EscrowCreated';
      } catch {
        return false;
      }
    });
    
    if (!escrowCreatedEvent) {
      logger.error('EscrowCreated event not found in transaction receipt');
      throw new Error('Failed to extract escrow ID: EscrowCreated event not found');
    }
    
    const parsedEvent = this.escrowService.contract.interface.parseLog(escrowCreatedEvent);
    const escrowIdBigInt = parsedEvent?.args[0];
    
    if (!escrowIdBigInt || typeof escrowIdBigInt !== 'bigint') {
      logger.error('Invalid escrow ID extracted from event');
      throw new Error('Failed to extract escrow ID: invalid value');
    }
    
    const escrowId = Number(escrowIdBigInt);
    
    if (!Number.isInteger(escrowId) || escrowId <= 0) {
      logger.error(`Invalid escrow ID value: ${escrowId}`);
      throw new Error('Failed to extract escrow ID: invalid escrow ID value');
    }
    
    const sanitizedMetadata = metadata ? sanitizeObject(metadata) : metadata;
    const sanitizedConversationContext = conversationContext ? sanitizeObject(conversationContext) : conversationContext;
    
    const transaction = new Transaction({
      transactionId: tx.hash,
      escrowId: escrowId.toString(),
      buyerEmail: sanitizedBuyerEmail,
      sellerEmail: sanitizedSellerEmail,
      amount: parseFloat(amount),
      currency: finalTokenAddress === ethers.ZeroAddress ? 'ETH' : 'USDC',
      type: metadata?.milestones ? 'service' : 'marketplace',
      metadata: sanitizedMetadata,
      conversationContext: sanitizedConversationContext,
      timeline: [{
        status: 'pending',
        description: 'Escrow created',
        actor: sanitizedBuyerEmail
      }]
    });

    await transaction.save();
    
    const response: ApiResponse = {
      success: true,
      data: {
        hash: tx.hash,
        escrowId,
        transactionId: transaction.transactionId
      }
    };
    
    res.status(201).json(response);
  });

  releaseEscrow = asyncHandler(async (req: Request, res: Response) => {
    const dto = { ...req.params, ...req.body } as ReleaseEscrowDto;
    const { escrowId, milestoneIndex } = dto;
    const tx = await this.escrowService.releasePayment(Number(escrowId), milestoneIndex || 0);
    
    await Transaction.findOneAndUpdate(
      { escrowId },
      { 
        status: 'completed',
        $push: {
          timeline: {
            status: 'completed',
            description: 'Payment released to seller',
            actor: 'system'
          }
        }
      }
    );
    
    const response: ApiResponse = {
      success: true,
      data: { hash: tx.hash }
    };
    
    res.status(200).json(response);
  });

  refundEscrow = asyncHandler(async (req: Request, res: Response) => {
    const dto = req.params as unknown as RefundEscrowDto;
    const { escrowId } = dto;
    const tx = await this.escrowService.cancelEscrow(Number(escrowId));
    
    await Transaction.findOneAndUpdate(
      { escrowId },
      { 
        status: 'cancelled',
        $push: {
          timeline: {
            status: 'cancelled',
            description: 'Payment refunded to buyer',
            actor: 'system'
          }
        }
      }
    );
    
    const response: ApiResponse = {
      success: true,
      data: { hash: tx.hash }
    };
    
    res.status(200).json(response);
  });

  disputeEscrow = asyncHandler(async (req: Request, res: Response) => {
    const dto = { ...req.params, ...req.body } as DisputeEscrowDto;
    const { escrowId, reason, evidence } = dto;
    
    const sanitizedReason = sanitizeString(reason);
    const sanitizedEvidence = evidence ? evidence.map((item: string) => sanitizeString(item)) : [];
    
    const tx = await this.escrowService.fileDispute(Number(escrowId), sanitizedReason);
    
    await Transaction.findOneAndUpdate(
      { escrowId },
      { 
        status: 'disputed',
        dispute: {
          reason: sanitizedReason,
          evidence: sanitizedEvidence,
          createdAt: new Date()
        },
        $push: {
          timeline: {
            status: 'disputed',
            description: `Dispute filed: ${sanitizedReason}`,
            actor: 'system'
          }
        }
      }
    );
    
    const response: ApiResponse = {
      success: true,
      data: { hash: tx.hash }
    };
    
    res.status(200).json(response);
  });

  getEscrow = asyncHandler(async (req: Request, res: Response) => {
    const dto = req.params as unknown as GetEscrowDto;
    const { escrowId } = dto;
    const escrow = await this.escrowService.getEscrow(Number(escrowId));
    
    const response: ApiResponse = {
      success: true,
      data: escrow
    };
    
    res.status(200).json(response);
  });

  openDispute = asyncHandler(async (req: Request, res: Response) => {
    const { escrowId } = req.params;
    const { evidence } = req.body;
    
    const tx = await this.disputeService.openDispute(escrowId, evidence);
    
    const response: ApiResponse = {
      success: true,
      data: { hash: tx.hash }
    };
    
    res.status(200).json(response);
  });

  addEvidence = asyncHandler(async (req: Request, res: Response) => {
    const { escrowId } = req.params;
    const { evidence } = req.body;
    
    const tx = await this.disputeService.addEvidence(escrowId, evidence);
    
    const response: ApiResponse = {
      success: true,
      data: { hash: tx.hash }
    };
    
    res.status(200).json(response);
  });

  resolveDispute = asyncHandler(async (req: Request, res: Response) => {
    const { escrowId } = req.params;
    const { winnerAddress } = req.body;
    
    const tx = await this.disputeService.resolveDispute(escrowId, winnerAddress);
    
    const response: ApiResponse = {
      success: true,
      data: { hash: tx.hash }
    };
    
    res.status(200).json(response);
  });

  getDispute = asyncHandler(async (req: Request, res: Response) => {
    const { escrowId } = req.params;
    const dispute = await this.disputeService.getDispute(escrowId);
    
    const response: ApiResponse = {
      success: true,
      data: dispute
    };
    
    res.status(200).json(response);
  });
}
