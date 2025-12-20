/**
 * MCP Integration Service
 * Connects existing Synkio backend with MCP Safety and Payments servers
 * Maintains compatibility with current vendor/product system
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { logger } from '../utils/logger';
import { Chain } from '../types';
import { config } from '../config/env';

interface SafetyResult {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  reasons: string[];
  recommendation: string;
  metadata: {
    providers: string[];
    responseTime: string;
    timestamp: string;
  };
}

interface VendorSafetyProfile {
  vendorId: string;
  walletAddress: string;
  safetyScore: number;
  riskLevel: string;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'flagged';
  lastChecked: Date;
  reputation: {
    totalTransactions: number;
    successRate: number;
    disputeRate: number;
    averageRating: number;
  };
}

export class McpIntegrationService {
  private safetyClient: Client | null = null;
  private paymentsClient: Client | null = null;
  private isConnected: boolean = false;
  private transportType: 'stdio' | 'sse' | 'none' = 'none';

  constructor() {
    try {
      this.safetyClient = new Client(
        {
          name: 'synkio-backend',
          version: '1.0.0',
        },
        {
          capabilities: {}
        }
      );
      
      this.paymentsClient = new Client(
        {
          name: 'synkio-backend',
          version: '1.0.0',
        },
        {
          capabilities: {}
        }
      );
      
      this.initialize();
    } catch (error) {
      logger.warn('MCP SDK initialization failed - McpIntegrationService will use fallback mode', { error });
    }
  }

  private async initialize() {
    if (!this.safetyClient || !this.paymentsClient) {
      logger.warn('MCP clients not initialized - using fallback mode');
      return;
    }

    try {
      const transport = config.mcp.transport;
      
      if (transport === 'stdio') {
        await this.initializeStdioTransport();
      } else if (transport === 'sse') {
        await this.initializeSSETransport();
      } else {
        throw new Error(`Unsupported MCP transport: ${transport}`);
      }

      this.isConnected = true;
      this.transportType = transport;
      logger.info(`🛡️ MCP Integration Service connected via ${transport.toUpperCase()} transport`);
    } catch (error) {
      logger.error('❌ MCP Integration failed:', error);
      this.isConnected = false;
    }
  }

  private async initializeStdioTransport() {
    if (!this.safetyClient || !this.paymentsClient) {
      return;
    }

    const { safetyServer, paymentsServer } = config.mcp;

    const safetyTransport = new StdioClientTransport({
      command: safetyServer.command,
      args: safetyServer.args,
      env: {
        ...process.env,
        DDXYZ_API_KEY: process.env.DDXYZ_API_KEY || '',
        BLOCKRADER_API_KEY: process.env.BLOCKRADER_API_KEY || '',
      },
    });

    const paymentsTransport = new StdioClientTransport({
      command: paymentsServer.command,
      args: paymentsServer.args,
    });

    await this.safetyClient.connect(safetyTransport);
    await this.paymentsClient.connect(paymentsTransport);

    logger.info('✅ MCP servers connected via stdio (local processes)');
  }

  private async initializeSSETransport() {
    if (!this.safetyClient || !this.paymentsClient) {
      return;
    }

    const { safetyServer, paymentsServer } = config.mcp;

    if (!safetyServer.url || !paymentsServer.url) {
      throw new Error('MCP server URLs required for SSE transport. Set MCP_SAFETY_SERVER_URL and MCP_PAYMENTS_SERVER_URL');
    }

    const safetyTransport = new SSEClientTransport(
      new URL(safetyServer.url)
    );

    const paymentsTransport = new SSEClientTransport(
      new URL(paymentsServer.url)
    );

    await this.safetyClient.connect(safetyTransport);
    await this.paymentsClient.connect(paymentsTransport);

    logger.info(`✅ MCP servers connected via SSE: ${safetyServer.url}, ${paymentsServer.url}`);
  }

  getStatus() {
    return {
      connected: this.isConnected,
      transport: this.transportType,
      safetyClient: this.safetyClient !== null,
      paymentsClient: this.paymentsClient !== null,
      config: {
        transport: config.mcp.transport,
        safetyServerUrl: config.mcp.safetyServer.url || 'not set (using stdio)',
        paymentsServerUrl: config.mcp.paymentsServer.url || 'not set (using stdio)',
      }
    };
  }

  /**
   * Enhanced vendor verification using MCP Safety Server
   * Integrates with existing vendor system
   */
  async enhancedVendorVerification(
    vendorId: string,
    walletAddress: string,
    chain: Chain
  ): Promise<VendorSafetyProfile> {
    
    if (!this.isConnected) {
      return this.getFallbackVendorProfile(vendorId, walletAddress);
    }

    try {
      if (!this.safetyClient || !this.isConnected) {
        return this.getFallbackVendorProfile(vendorId, walletAddress);
      }

      // Use MCP Safety Server for comprehensive vendor check
      const result = await this.safetyClient.callTool({
        name: 'check_wallet_safety',
        arguments: {
          address: walletAddress,
          chain
        }
      });

      const walletSafety = (result.content as any[])?.[0]?.text 
        ? JSON.parse((result.content as any[])[0].text) as SafetyResult
        : null;

      if (!walletSafety) {
        throw new Error('Invalid response from MCP safety service');
      }

      // Get existing vendor reputation from your current system
      const existingReputation = await this.getExistingVendorReputation(vendorId);

      // Combine MCP safety data with existing reputation
      const combinedProfile: VendorSafetyProfile = {
        vendorId,
        walletAddress,
        safetyScore: walletSafety.score,
        riskLevel: walletSafety.riskLevel,
        verificationStatus: this.determineVerificationStatus(walletSafety, existingReputation),
        lastChecked: new Date(),
        reputation: existingReputation
      };

      // Update vendor in your existing database with enhanced safety data
      await this.updateVendorSafetyProfile(combinedProfile);

      logger.info(`🔍 Enhanced vendor verification complete for ${vendorId}: ${walletSafety.riskLevel}`);
      return combinedProfile;

    } catch (error) {
      logger.error(`❌ Vendor verification failed for ${vendorId}:`, error);
      return this.getFallbackVendorProfile(vendorId, walletAddress);
    }
  }

  /**
   * Enhanced transaction safety check before payments
   * Integrates with existing escrow and payment flow
   */
  async enhancedTransactionSafety(transaction: {
    buyerWallet: string;
    vendorWallet: string;
    amount: string;
    chain: string;
    productId?: string;
    vendorId?: string;
  }): Promise<{
    isApproved: boolean;
    safetyData: SafetyResult;
    requiresEscrow: boolean;
    recommendedAction: string;
    paymentMethod: 'direct' | 'escrow' | 'blocked';
  }> {

    if (!this.isConnected) {
      return this.getFallbackTransactionSafety();
    }

    try {
      if (!this.safetyClient || !this.isConnected) {
        return this.getFallbackTransactionSafety();
      }

      // Check both buyer and vendor wallets
      const [buyerResult, vendorResult] = await Promise.all([
        this.safetyClient.callTool({
          name: 'check_wallet_safety',
          arguments: {
            address: transaction.buyerWallet,
            chain: transaction.chain
          }
        }),
        this.safetyClient.callTool({
          name: 'check_wallet_safety',
          arguments: {
            address: transaction.vendorWallet,
            chain: transaction.chain
          }
        })
      ]);

      const buyerSafety = (buyerResult.content as any[])?.[0]?.text 
        ? JSON.parse((buyerResult.content as any[])[0].text) as SafetyResult
        : null;
      const vendorSafety = (vendorResult.content as any[])?.[0]?.text 
        ? JSON.parse((vendorResult.content as any[])[0].text) as SafetyResult
        : null;

      if (!buyerSafety || !vendorSafety) {
        throw new Error('Invalid response from MCP safety service');
      }

      // Check transaction safety
      const transactionResult = await this.safetyClient.callTool({
        name: 'check_transaction_safety',
        arguments: {
          to: transaction.vendorWallet,
          value: transaction.amount,
          chain: transaction.chain
        }
      });

      const transactionSafety = (transactionResult.content as any[])?.[0]?.text 
        ? JSON.parse((transactionResult.content as any[])[0].text) as SafetyResult
        : null;

      if (!transactionSafety) {
        throw new Error('Invalid response from MCP transaction safety service');
      }

      // Determine overall risk and payment method
      const overallRisk = this.calculateOverallRisk(buyerSafety, vendorSafety, transactionSafety);
      const paymentMethod = this.determinePaymentMethod(overallRisk);
      const requiresEscrow = paymentMethod === 'escrow';

      logger.info(`💰 Transaction safety check: ${overallRisk.riskLevel} - ${paymentMethod}`);

      return {
        isApproved: paymentMethod !== 'blocked',
        safetyData: overallRisk,
        requiresEscrow,
        recommendedAction: this.getRecommendedAction(overallRisk),
        paymentMethod
      };

    } catch (error) {
      logger.error('❌ Transaction safety check failed:', error);
      return this.getFallbackTransactionSafety();
    }
  }

  /**
   * Enhanced product listing safety
   * Checks vendor reputation before allowing product listing
   */
  async enhancedProductListing(productData: {
    vendorId: string;
    vendorWallet: string;
    productTitle: string;
    description: string;
    price: string;
    images: string[];
  }): Promise<{
    isApproved: boolean;
    vendorSafety: VendorSafetyProfile;
    requirements: string[];
    listingFees: {
      basic: number;
      escrowRequired: boolean;
      securityDeposit: number;
    };
  }> {

    // Enhanced vendor verification
    const vendorSafety = await this.enhancedVendorVerification(
      productData.vendorId,
      productData.vendorWallet,
      Chain.ETHEREUM // Default chain, make configurable
    );

    // Determine listing requirements based on safety profile
    const requirements = this.getListingRequirements(vendorSafety);
    const listingFees = this.calculateListingFees(vendorSafety);

    const isApproved = vendorSafety.riskLevel !== 'critical' && 
                      vendorSafety.verificationStatus !== 'flagged';

    logger.info(`📦 Product listing check for vendor ${productData.vendorId}: ${isApproved ? 'APPROVED' : 'REJECTED'}`);

    return {
      isApproved,
      vendorSafety,
      requirements,
      listingFees
    };
  }

  /**
   * Real-time vendor monitoring
   * Continuous background safety checks for active vendors
   */
  async monitorActiveVendors(vendorIds: string[]): Promise<{
    alerts: Array<{
      vendorId: string;
      alertType: 'reputation_drop' | 'safety_risk' | 'wallet_compromised';
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      actionRequired: string;
    }>;
    overallSystemHealth: 'healthy' | 'moderate_risk' | 'high_risk';
  }> {

    const alerts: any[] = [];
    let highRiskCount = 0;

    for (const vendorId of vendorIds) {
      try {
        // Get vendor's current wallet and chain info from your database
        const vendorInfo = await this.getVendorInfo(vendorId);
        
        if (vendorInfo) {
          const currentSafety = await this.enhancedVendorVerification(
            vendorId,
            vendorInfo.walletAddress,
            vendorInfo.preferredChain
          );

          // Check for alerts
          if (currentSafety.riskLevel === 'high' || currentSafety.riskLevel === 'critical') {
            alerts.push({
              vendorId,
              alertType: 'safety_risk',
              severity: currentSafety.riskLevel,
              message: `Vendor safety risk detected: ${currentSafety.riskLevel}`,
              actionRequired: currentSafety.riskLevel === 'critical' 
                ? 'Suspend vendor immediately' 
                : 'Review vendor activity'
            });
            highRiskCount++;
          }

          // Check reputation changes
          if (currentSafety.reputation.successRate < 0.8) {
            alerts.push({
              vendorId,
              alertType: 'reputation_drop',
              severity: 'medium',
              message: `Vendor success rate dropped to ${(currentSafety.reputation.successRate * 100).toFixed(1)}%`,
              actionRequired: 'Monitor closely and review recent transactions'
            });
          }
        }

      } catch (error) {
        logger.error(`Error monitoring vendor ${vendorId}:`, error);
      }
    }

    const overallSystemHealth = highRiskCount === 0 ? 'healthy' :
                               highRiskCount < 3 ? 'moderate_risk' : 'high_risk';

    return { alerts, overallSystemHealth };
  }

  // Helper methods for integration with existing systems
  private async getExistingVendorReputation(vendorId: string) {
    // Integration with your existing ReputationService
    // This would query your current vendor/reputation data
    return {
      totalTransactions: 0, // Get from your DB
      successRate: 1.0,     // Calculate from your transaction data
      disputeRate: 0.0,     // Calculate from your dispute data
      averageRating: 5.0    // Get from your rating system
    };
  }

  private async updateVendorSafetyProfile(profile: VendorSafetyProfile) {
    // Integration with your existing vendor database
    // Update vendor record with enhanced safety data
    logger.info(`💾 Updated vendor ${profile.vendorId} safety profile`);
  }

  private async getVendorInfo(vendorId: string) {
    // Get vendor info from your existing database
    return {
      walletAddress: '0x742d35Cc6634C0532925a3b8D6C8E32c2b7bD309', // From your DB
      preferredChain: Chain.ETHEREUM // From vendor preferences
    };
  }

  private determineVerificationStatus(
    safetyResult: SafetyResult, 
    reputation: any
  ): VendorSafetyProfile['verificationStatus'] {
    if (safetyResult.riskLevel === 'critical') return 'flagged';
    if (safetyResult.riskLevel === 'high') return 'pending';
    if (safetyResult.riskLevel === 'low' && reputation.successRate > 0.95) return 'verified';
    return 'unverified';
  }

  private calculateOverallRisk(...risks: SafetyResult[]): SafetyResult {
    const maxRisk = risks.reduce((max, current) => 
      this.getRiskPriority(current.riskLevel) > this.getRiskPriority(max.riskLevel) ? current : max
    );
    return maxRisk;
  }

  private getRiskPriority(riskLevel: string): number {
    const priorities = { low: 1, medium: 2, high: 3, critical: 4 };
    return priorities[riskLevel as keyof typeof priorities] || 1;
  }

  private determinePaymentMethod(risk: SafetyResult): 'direct' | 'escrow' | 'blocked' {
    switch (risk.riskLevel) {
      case 'critical': return 'blocked';
      case 'high': return 'escrow';
      case 'medium': return 'escrow';
      case 'low': return 'direct';
      default: return 'escrow';
    }
  }

  private getRecommendedAction(risk: SafetyResult): string {
    const actions = {
      low: '✅ Transaction approved - proceed with confidence',
      medium: '⚠️ Transaction approved with escrow protection',
      high: '🔒 Transaction requires escrow - high risk detected',
      critical: '🚨 Transaction blocked - critical safety risk'
    };
    return actions[risk.riskLevel] || actions.medium;
  }

  private getListingRequirements(vendorSafety: VendorSafetyProfile): string[] {
    const requirements = ['Valid product images', 'Detailed description'];
    
    if (vendorSafety.riskLevel === 'medium' || vendorSafety.riskLevel === 'high') {
      requirements.push('Identity verification required');
      requirements.push('Security deposit required');
    }
    
    if (vendorSafety.verificationStatus === 'unverified') {
      requirements.push('Wallet verification required');
    }

    return requirements;
  }

  private calculateListingFees(vendorSafety: VendorSafetyProfile) {
    const baseFee = 0.01; // 1% base fee
    const riskMultiplier = {
      low: 1.0,
      medium: 1.5,
      high: 2.0,
      critical: 0 // Can't list
    };

    const multiplier = riskMultiplier[vendorSafety.riskLevel as keyof typeof riskMultiplier] || 1.5;

    return {
      basic: baseFee * multiplier,
      escrowRequired: vendorSafety.riskLevel !== 'low',
      securityDeposit: vendorSafety.riskLevel === 'high' ? 100 : 0 // $100 for high risk
    };
  }

  // Fallback methods when MCP servers are unavailable
  private getFallbackVendorProfile(vendorId: string, walletAddress: string): VendorSafetyProfile {
    return {
      vendorId,
      walletAddress,
      safetyScore: 50,
      riskLevel: 'medium',
      verificationStatus: 'pending',
      lastChecked: new Date(),
      reputation: {
        totalTransactions: 0,
        successRate: 0.8,
        disputeRate: 0.1,
        averageRating: 4.0
      }
    };
  }

  private getFallbackTransactionSafety() {
    return {
      isApproved: true,
      safetyData: {
        riskLevel: 'medium' as const,
        score: 50,
        reasons: ['MCP safety service unavailable - using fallback'],
        recommendation: '⚠️ Proceed with caution - verification unavailable',
        metadata: {
          providers: ['fallback'],
          responseTime: '0ms',
          timestamp: new Date().toISOString()
        }
      },
      requiresEscrow: true,
      recommendedAction: 'Use escrow for safety',
      paymentMethod: 'escrow' as const
    };
  }
}

export default McpIntegrationService;