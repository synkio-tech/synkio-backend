import axios from 'axios';
import { logger } from '../utils/logger';

export interface BlockRaderWalletData {
  address: string;
  suspiciousActivity?: boolean;
  newAccount?: boolean;
  flags?: string[];
  riskScore?: number;
  [key: string]: any;
}

export class BlockRaderService {
  private apiKey: string;
  private baseUrl = 'https://api.blockrader.com';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.BLOCKRADER_API_KEY || '';
    
    if (!this.apiKey) {
      logger.warn('BlockRader API key not configured');
    }
  }

  async getWalletIntel(address: string): Promise<BlockRaderWalletData | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/wallet/${address}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('BlockRader wallet intel API error:', {
        error: error.message,
        address
      });
      return null;
    }
  }

  async checkWalletSafety(address: string): Promise<{
    suspiciousActivity: boolean;
    newAccount: boolean;
    flags: string[];
  } | null> {
    const data = await this.getWalletIntel(address);
    
    if (!data) {
      return null;
    }

    return {
      suspiciousActivity: data.suspiciousActivity || false,
      newAccount: data.newAccount || false,
      flags: data.flags || []
    };
  }
}
