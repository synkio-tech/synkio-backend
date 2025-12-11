import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware';
import { ApiResponse } from '../types';

export class ReputationController {
  constructor(private reputationService: any) {}

  getReputation = asyncHandler(async (req: Request, res: Response) => {
    const { userAddress } = req.params;
    const reputation = await this.reputationService.getReputation(userAddress);
    
    const response: ApiResponse = {
      success: true,
      data: { reputation }
    };
    
    res.status(200).json(response);
  });

  updateReputation = asyncHandler(async (req: Request, res: Response) => {
    const { userAddress, newReputation } = req.body;
    const tx = await this.reputationService.updateReputation(userAddress, newReputation);
    
    const response: ApiResponse = {
      success: true,
      data: { hash: tx.hash }
    };
    
    res.status(200).json(response);
  });
}
