import { Request, Response } from 'express';
import { Transaction } from '../models/Transaction';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware';
import { ApiResponse, TransactionQuery } from '../types';

export class TransactionController {
  constructor(
    private paymentService: any,
    private reputationService: any
  ) {}

  getTransactions = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.params;
    const { page = 1, limit = 20, status, type, sortBy = 'createdAt', sortOrder = 'desc' } = req.query as TransactionQuery;
    
    const query: any = {
      $or: [{ buyerEmail: email }, { sellerEmail: email }]
    };
    
    if (status) query.status = status;
    if (type) query.type = type;
    
    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    const transactions = await Transaction.find(query)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));
    
    const total = await Transaction.countDocuments(query);

    const response: ApiResponse = {
      success: true,
      data: {
        transactions,
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

  getTransaction = asyncHandler(async (req: Request, res: Response) => {
    const { email, transactionId } = req.params;
    const transaction = await Transaction.findOne({
      transactionId,
      $or: [{ buyerEmail: email }, { sellerEmail: email }]
    });
    
    if (!transaction) {
      return res.status(404).json({ 
        success: false,
        error: 'Transaction not found' 
      });
    }
    
    const response: ApiResponse = {
      success: true,
      data: transaction
    };
    
    res.status(200).json(response);
  });

  makeDirectPayment = asyncHandler(async (req: Request, res: Response) => {
    const { payee, amount, tokenAddress } = req.body;
    const tx = await this.paymentService.makePayment(payee, amount, tokenAddress);
    
    const response: ApiResponse = {
      success: true,
      data: { hash: tx.hash }
    };
    
    res.status(200).json(response);
  });

  updateTransactionStatus = asyncHandler(async (req: Request, res: Response) => {
    const { transactionId } = req.params;
    const { status, description, actor } = req.body;
    
    const transaction = await Transaction.findOneAndUpdate(
      { transactionId },
      {
        status,
        $push: {
          timeline: {
            status,
            description: description || `Status updated to ${status}`,
            actor: actor || 'system'
          }
        }
      },
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({ 
        success: false,
        error: 'Transaction not found' 
      });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Transaction status updated',
      data: transaction
    };
    
    res.status(200).json(response);
  });

  getTransactionTimeline = asyncHandler(async (req: Request, res: Response) => {
    const { transactionId } = req.params;
    const transaction = await Transaction.findOne({ transactionId });
    
    if (!transaction) {
      return res.status(404).json({ 
        success: false,
        error: 'Transaction not found' 
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        transactionId: transaction.transactionId,
        status: transaction.status,
        timeline: transaction.timeline
      }
    };
    
    res.status(200).json(response);
  });
}
