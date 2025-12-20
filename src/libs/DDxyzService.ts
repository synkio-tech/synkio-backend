import axios from 'axios';
import { logger } from '../utils/logger';

export interface DDxyzThreatRisk {
  riskScore?: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  flaggedReasons?: string[];
  lastUpdated?: string;
  [key: string]: any;
}

export interface DDxyzContractRisk {
  riskScore?: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  verified?: boolean;
  vulnerabilities?: string[];
  [key: string]: any;
}

export class DDxyzService {
  private apiKey: string;
  private baseUrl = 'https://api.dd.xyz/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.DDXYZ_API_KEY || '';
    
    if (!this.apiKey) {
      logger.warn('DD.xyz API key not configured');
    }
  }

  async getThreatRisk(address: string, chain: 'ethereum' | 'base' | 'solana'): Promise<DDxyzThreatRisk | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/threat-risk`,
        { address, chain },
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
      logger.error('DD.xyz threat risk API error:', {
        error: error.message,
        address,
        chain
      });
      return null;
    }
  }

  async getContractRisk(address: string, chain: 'ethereum' | 'base' | 'solana'): Promise<DDxyzContractRisk | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/contract-risk`,
        { address, chain },
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
      logger.error('DD.xyz contract risk API error:', {
        error: error.message,
        address,
        chain
      });
      return null;
    }
  }

  async getUrlRisk(url: string): Promise<any> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/url-risk`,
        { url },
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
      logger.error('DD.xyz URL risk API error:', {
        error: error.message,
        url
      });
      return null;
    }
  }
}
