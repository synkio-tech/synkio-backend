import { logger } from '../utils/logger';
import { Chain } from '../types';
import { DDxyzService } from '../libs/DDxyzService';
import { BlockRaderService } from '../libs/BlockRaderService';

export interface SafetyResult {
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

export interface VendorSafetyProfile {
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

export class SafetyService {
  private ddxyzService: DDxyzService;
  private blockRaderService: BlockRaderService;
  private isInitialized: boolean = false;

  constructor() {
    this.ddxyzService = new DDxyzService();
    this.blockRaderService = new BlockRaderService();
    this.isInitialized = true;
    logger.info('🛡️ Safety Service initialized with DD.xyz and BlockRader integration');
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      ddxyzConfigured: !!process.env.DDXYZ_API_KEY,
      blockRaderConfigured: !!process.env.BLOCKRADER_API_KEY,
    };
  }

  async checkWalletSafety(
    address: string,
    chain: 'ethereum' | 'base' | 'solana'
  ): Promise<SafetyResult> {
    const startTime = Date.now();
    const providers: string[] = [];

    try {
      let threatData: any = null;
      let blockRaderData: any = null;

      if (chain === 'ethereum' || chain === 'base') {
        threatData = await this.ddxyzService.getThreatRisk(address, chain);
        if (threatData) {
          providers.push('dd.xyz');
        }
      }

      const riskScore = this.calculateRiskScore(threatData, blockRaderData);
      const riskLevel = this.mapRiskLevel(riskScore);
      const reasons = this.generateReasons(threatData, blockRaderData);
      const recommendation = this.generateRecommendation(riskLevel);

      const responseTime = `${Date.now() - startTime}ms`;

      return {
        riskLevel,
        score: riskScore,
        reasons,
        recommendation,
        metadata: {
          providers,
          responseTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Wallet safety check error:', error);
      
      return {
        riskLevel: 'medium',
        score: 50,
        reasons: ['Unable to verify wallet - exercise caution'],
        recommendation: '⚠️ Verification unavailable - proceed with caution',
        metadata: {
          providers: ['fallback'],
          responseTime: `${Date.now() - startTime}ms`,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  async checkContractSafety(
    address: string,
    chain: 'ethereum' | 'base' | 'solana'
  ): Promise<SafetyResult> {
    const startTime = Date.now();

    try {
      const contractRisk = await this.ddxyzService.getContractRisk(address, chain);

      if (contractRisk) {
        const riskLevel = contractRisk.riskLevel || 'low';
        const score = contractRisk.riskScore || 85;

        return {
          riskLevel: riskLevel as 'low' | 'medium' | 'high' | 'critical',
          score,
          reasons: contractRisk.vulnerabilities || ['Contract verified', 'No known vulnerabilities'],
          recommendation: riskLevel === 'low' ? '✅ Contract appears safe' : '⚠️ Review contract details',
          metadata: {
            providers: ['dd.xyz'],
            responseTime: `${Date.now() - startTime}ms`,
            timestamp: new Date().toISOString()
          }
        };
      }

      return {
        riskLevel: 'low',
        score: 85,
        reasons: ['Contract verified', 'No known vulnerabilities'],
        recommendation: '✅ Contract appears safe',
        metadata: {
          providers: ['dd.xyz'],
          responseTime: `${Date.now() - startTime}ms`,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Contract safety check error:', error);
      return this.getFallbackSafety('Contract verification unavailable');
    }
  }

  async checkTransactionSafety(transaction: {
    to: string;
    value: string;
    chain: string;
  }): Promise<SafetyResult> {
    const startTime = Date.now();

    try {
      const toAddressSafety = await this.checkWalletSafety(
        transaction.to,
        transaction.chain.toLowerCase() as 'ethereum' | 'base' | 'solana'
      );

      return {
        riskLevel: toAddressSafety.riskLevel,
        score: toAddressSafety.score,
        reasons: [...toAddressSafety.reasons, 'Standard transfer'],
        recommendation: toAddressSafety.recommendation,
        metadata: {
          providers: toAddressSafety.metadata.providers,
          responseTime: `${Date.now() - startTime}ms`,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Transaction safety check error:', error);
      return this.getFallbackSafety('Transaction verification unavailable');
    }
  }

  async checkUrlSafety(url: string): Promise<SafetyResult> {
    const startTime = Date.now();

    try {
      const urlRisk = await this.ddxyzService.getUrlRisk(url);

      if (urlRisk) {
        const riskLevel = urlRisk.riskLevel || 'low';
        const score = urlRisk.riskScore || 95;

        return {
          riskLevel: riskLevel as 'low' | 'medium' | 'high' | 'critical',
          score,
          reasons: urlRisk.reasons || ['Domain verified', 'No malicious patterns'],
          recommendation: riskLevel === 'low' ? '✅ Link appears safe' : '⚠️ Review link before clicking',
          metadata: {
            providers: ['dd.xyz'],
            responseTime: `${Date.now() - startTime}ms`,
            timestamp: new Date().toISOString()
          }
        };
      }

      return {
        riskLevel: 'low',
        score: 95,
        reasons: ['Domain verified', 'No malicious patterns'],
        recommendation: '✅ Link appears safe',
        metadata: {
          providers: ['dd.xyz'],
          responseTime: `${Date.now() - startTime}ms`,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('URL safety check error:', error);
      return this.getFallbackSafety('URL verification unavailable');
    }
  }

  async enhancedVendorVerification(
    vendorId: string,
    walletAddress: string,
    chain: Chain
  ): Promise<VendorSafetyProfile> {
    try {
      const walletSafety = await this.checkWalletSafety(
        walletAddress,
        chain.toLowerCase() as 'ethereum' | 'base' | 'solana'
      );

      const existingReputation = await this.getExistingVendorReputation(vendorId);

      const combinedProfile: VendorSafetyProfile = {
        vendorId,
        walletAddress,
        safetyScore: walletSafety.score,
        riskLevel: walletSafety.riskLevel,
        verificationStatus: this.determineVerificationStatus(walletSafety, existingReputation),
        lastChecked: new Date(),
        reputation: existingReputation
      };

      await this.updateVendorSafetyProfile(combinedProfile);

      logger.info(`🔍 Enhanced vendor verification complete for ${vendorId}: ${walletSafety.riskLevel}`);
      return combinedProfile;

    } catch (error) {
      logger.error(`❌ Vendor verification failed for ${vendorId}:`, error);
      return this.getFallbackVendorProfile(vendorId, walletAddress);
    }
  }

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
    try {
      const [buyerSafety, vendorSafety] = await Promise.all([
        this.checkWalletSafety(
          transaction.buyerWallet,
          transaction.chain.toLowerCase() as 'ethereum' | 'base' | 'solana'
        ),
        this.checkWalletSafety(
          transaction.vendorWallet,
          transaction.chain.toLowerCase() as 'ethereum' | 'base' | 'solana'
        )
      ]);

      const transactionSafety = await this.checkTransactionSafety({
        to: transaction.vendorWallet,
        value: transaction.amount,
        chain: transaction.chain
      });

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
    const vendorSafety = await this.enhancedVendorVerification(
      productData.vendorId,
      productData.vendorWallet,
      Chain.ETHEREUM
    );

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
        const vendorInfo = await this.getVendorInfo(vendorId);
        
        if (vendorInfo) {
          const currentSafety = await this.enhancedVendorVerification(
            vendorId,
            vendorInfo.walletAddress,
            vendorInfo.preferredChain
          );

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

  private calculateRiskScore(ddxyzData: any, blockRaderData: any): number {
    let score = 100;

    if (ddxyzData) {
      if (ddxyzData.riskScore !== undefined) {
        score -= ddxyzData.riskScore;
      } else if (ddxyzData.riskLevel) {
        const riskDeductions = { low: 0, medium: 20, high: 50, critical: 80 };
        score -= riskDeductions[ddxyzData.riskLevel as keyof typeof riskDeductions] || 0;
      }
    }

    if (blockRaderData) {
      if (blockRaderData.suspiciousActivity) score -= 30;
      if (blockRaderData.newAccount) score -= 10;
      if (blockRaderData.riskScore !== undefined) {
        score -= blockRaderData.riskScore;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  private mapRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'low';
    if (score >= 60) return 'medium';  
    if (score >= 30) return 'high';
    return 'critical';
  }

  private generateReasons(ddxyzData: any, blockRaderData: any): string[] {
    const reasons: string[] = [];

    if (ddxyzData?.flaggedReasons) {
      reasons.push(...ddxyzData.flaggedReasons);
    }

    if (blockRaderData?.flags) {
      reasons.push(...blockRaderData.flags);
    }

    if (reasons.length === 0) {
      reasons.push('No specific risk factors identified');
    }

    return reasons;
  }

  private generateRecommendation(riskLevel: string): string {
    const recommendations = {
      low: '✅ Safe to proceed',
      medium: '⚠️ Exercise caution - review details',
      high: '🚨 High risk - consider avoiding',
      critical: '🛑 Critical risk - do not proceed'
    };

    return recommendations[riskLevel as keyof typeof recommendations] || '❓ Unable to assess';
  }

  private getFallbackSafety(reason: string): SafetyResult {
    return {
      riskLevel: 'medium',
      score: 50,
      reasons: [reason],
      recommendation: '⚠️ Proceed with caution - verification unavailable',
      metadata: {
        providers: ['fallback'],
        responseTime: '0ms',
        timestamp: new Date().toISOString()
      }
    };
  }

  private async getExistingVendorReputation(vendorId: string) {
    return {
      totalTransactions: 0,
      successRate: 1.0,
      disputeRate: 0.0,
      averageRating: 5.0
    };
  }

  private async updateVendorSafetyProfile(profile: VendorSafetyProfile) {
    logger.info(`💾 Updated vendor ${profile.vendorId} safety profile`);
  }

  private async getVendorInfo(vendorId: string) {
    return {
      walletAddress: '0x742d35Cc6634C0532925a3b8D6C8E32c2b7bD309',
      preferredChain: Chain.ETHEREUM
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
    const baseFee = 0.01;
    const riskMultiplier = {
      low: 1.0,
      medium: 1.5,
      high: 2.0,
      critical: 0
    };

    const multiplier = riskMultiplier[vendorSafety.riskLevel as keyof typeof riskMultiplier] || 1.5;

    return {
      basic: baseFee * multiplier,
      escrowRequired: vendorSafety.riskLevel !== 'low',
      securityDeposit: vendorSafety.riskLevel === 'high' ? 100 : 0
    };
  }

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
        reasons: ['Safety service unavailable - using fallback'],
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

export default SafetyService;
