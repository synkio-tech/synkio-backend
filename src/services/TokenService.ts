import { logger } from '../utils/logger';
import { ethers } from 'ethers';

export interface ProviderConfig {
  rpcUrl: string;
  chainId?: number;
  name: string;
  timeout?: number;
}

export class TokenService {
  private static readonly BASE_SEPOLIA_TOKENS: Record<string, { symbol: string; decimals: number; name: string }> = {
    '0x0000000000000000000000000000000000000000': {
      symbol: 'ETH',
      decimals: 18,
      name: 'Ethereum'
    },
    '0x036CbD53842c5426634e7929541eC2318f3dCF7e': {
      symbol: 'USDC',
      decimals: 6,
      name: 'USD Coin'
    },
    '0x4200000000000000000000000000000000000006': {
      symbol: 'WETH',
      decimals: 18,
      name: 'Wrapped Ethereum'
    }
  };

  constructor(private providerConfig: ProviderConfig) {
    logger.info(`TokenService initialized for ${providerConfig.name}`);
  }

  async validateToken(tokenAddress: string): Promise<boolean> {
    if (tokenAddress === ethers.ZeroAddress) {
      return true;
    }

    try {
      const tokenInfo = this.getTokenInfo(tokenAddress);
      return !!tokenInfo;
    } catch (error) {
      logger.error(`Token validation failed for ${tokenAddress}:`, error);
      return false;
    }
  }

  getTokenInfo(tokenAddress: string): { symbol: string; decimals: number; name: string } | null {
    const normalizedAddress = tokenAddress.toLowerCase();
    return TokenService.BASE_SEPOLIA_TOKENS[normalizedAddress] || null;
  }

  async getSupportedTokens(): Promise<Array<{ address: string; symbol: string; decimals: number; name: string }>> {
    return Object.entries(TokenService.BASE_SEPOLIA_TOKENS).map(([address, info]) => ({
      address,
      ...info
    }));
  }

  async getTokenSymbol(tokenAddress: string): Promise<string> {
    const info = this.getTokenInfo(tokenAddress);
    return info?.symbol || 'UNKNOWN';
  }

  async getTokenDecimals(tokenAddress: string): Promise<number> {
    const info = this.getTokenInfo(tokenAddress);
    return info?.decimals || 18;
  }
}

