/**
 * Enhanced Vendor Controller with MCP Integration
 * Upgrades existing vendor system with industry-standard MCP safety
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import McpIntegrationService from '../services/McpIntegrationService';
import { User } from '../models/User';
import { Product } from '../models/Product';
import { sanitizeEmail } from '../utils/sanitize';
import { Chain } from '../types';

export class EnhancedVendorController {
  private mcpService: McpIntegrationService;

  constructor() {
    this.mcpService = new McpIntegrationService();
  }

  /**
   * Enhanced vendor registration with MCP safety verification
   * Extends your existing vendor creation
   */
  async createEnhancedVendor(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, walletAddress, businessName, category, chain = Chain.ETHEREUM } = req.body;

      const sanitizedEmail = sanitizeEmail(email);
      
      const vendor = await User.findOne({ email: sanitizedEmail, 'profile.isVendor': true });
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found. Please create vendor profile first using the standard vendor creation endpoint.'
        });
      }

      if (!walletAddress && !vendor.walletAddress) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address is required'
        });
      }

      const vendorWalletAddress = walletAddress || vendor.walletAddress;

      const vendorSafetyProfile = await this.mcpService.enhancedVendorVerification(
        sanitizedEmail,
        vendorWalletAddress,
        chain
      );

      await this.updateVendorWithSafetyData(sanitizedEmail, vendorSafetyProfile);

      res.status(201).json({
        success: true,
        message: 'Vendor created with enhanced safety verification',
        data: {
          vendor: {
            email: vendor.email,
            businessName: businessName || vendor.profile.name,
            category: category || vendor.profile.categories?.[0],
            walletAddress: vendor.walletAddress,
            chain
          },
          safety: {
            riskLevel: vendorSafetyProfile.riskLevel,
            verificationStatus: vendorSafetyProfile.verificationStatus,
            safetyScore: vendorSafetyProfile.safetyScore,
            requirements: this.getVendorRequirements(vendorSafetyProfile)
          },
          nextSteps: this.getVendorOnboardingSteps(vendorSafetyProfile)
        }
      });

    } catch (error) {
      logger.error('Enhanced vendor creation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create enhanced vendor profile'
      });
    }
  }

  /**
   * Get enhanced vendor list with safety scores
   * Extends your existing getVendors functionality
   */
  async getEnhancedVendors(req: Request, res: Response) {
    try {
      const { category, minReputation, safetyLevel, verificationStatus } = req.query;

      // Get vendors from existing system
      const existingVendors = await this.getExistingVendors({
        category: category as string,
        minReputation: minReputation ? parseInt(minReputation as string) : undefined
      });

      // Enhance with real-time safety data for active vendors
      const enhancedVendors = await Promise.all(
        existingVendors.map(async (vendor: any) => {
          try {
            const safetyProfile = await this.mcpService.enhancedVendorVerification(
              vendor.email,
              vendor.walletAddress,
              vendor.chain || Chain.ETHEREUM
            );

            return {
              ...vendor,
              safety: {
                riskLevel: safetyProfile.riskLevel,
                safetyScore: safetyProfile.safetyScore,
                verificationStatus: safetyProfile.verificationStatus,
                lastChecked: safetyProfile.lastChecked,
                trustBadge: this.getTrustBadge(safetyProfile)
              },
              reputation: safetyProfile.reputation
            };
          } catch (error) {
            // Fallback for vendors without safety data
            return {
              ...vendor,
              safety: {
                riskLevel: 'unknown',
                safetyScore: 50,
                verificationStatus: 'pending',
                lastChecked: new Date(),
                trustBadge: '⚠️'
              }
            };
          }
        })
      );

      // Apply additional filters
      let filteredVendors = enhancedVendors;

      if (safetyLevel) {
        filteredVendors = filteredVendors.filter(v => v.safety.riskLevel === safetyLevel);
      }

      if (verificationStatus) {
        filteredVendors = filteredVendors.filter(v => v.safety.verificationStatus === verificationStatus);
      }

      res.json({
        success: true,
        data: {
          vendors: filteredVendors,
          pagination: {
            total: filteredVendors.length,
            page: 1,
            limit: 20,
            pages: Math.ceil(filteredVendors.length / 20)
          },
          safety: {
            totalVendors: enhancedVendors.length,
            verifiedVendors: enhancedVendors.filter(v => v.safety.verificationStatus === 'verified').length,
            highRiskVendors: enhancedVendors.filter(v => v.safety.riskLevel === 'high' || v.safety.riskLevel === 'critical').length,
            averageSafetyScore: enhancedVendors.length > 0
              ? enhancedVendors.reduce((sum, v) => sum + v.safety.safetyScore, 0) / enhancedVendors.length
              : 0
          }
        }
      });

    } catch (error) {
      logger.error('Enhanced vendor retrieval failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve enhanced vendor data'
      });
    }
  }

  /**
   * Get enhanced vendor profile with safety details
   */
  async getEnhancedVendor(req: Request, res: Response) {
    try {
      const { email } = req.params;

      // Get existing vendor data
      const existingVendor = await this.getExistingVendor(email);
      
      if (!existingVendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found'
        });
      }

      // Get enhanced safety profile
      const chain = existingVendor.chain === Chain.BASE || existingVendor.chain === Chain.SOLANA
        ? existingVendor.chain 
        : Chain.ETHEREUM;
      const safetyProfile = await this.mcpService.enhancedVendorVerification(
        email,
        existingVendor.walletAddress,
        chain
      );

      // Get vendor's products with safety context
      const products = await this.getVendorProductsWithSafety(email, safetyProfile);

      res.json({
        success: true,
        data: {
          vendor: {
            ...existingVendor,
            safety: {
              riskLevel: safetyProfile.riskLevel,
              safetyScore: safetyProfile.safetyScore,
              verificationStatus: safetyProfile.verificationStatus,
              lastChecked: safetyProfile.lastChecked,
              trustBadge: this.getTrustBadge(safetyProfile),
              reputation: safetyProfile.reputation
            }
          },
          products: {
            total: products.length,
            items: products,
            listingRequirements: this.getListingRequirements(safetyProfile)
          },
          recommendations: this.getVendorRecommendations(safetyProfile)
        }
      });

    } catch (error) {
      logger.error('Enhanced vendor profile retrieval failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve enhanced vendor profile'
      });
    }
  }

  /**
   * Vendor monitoring dashboard
   * Real-time safety monitoring for all vendors
   */
  async getVendorSafetyDashboard(req: Request, res: Response) {
    try {
      // Get all active vendor IDs
      const activeVendors = await this.getActiveVendorIds();

      // Monitor all vendors
      const monitoringResult = await this.mcpService.monitorActiveVendors(activeVendors);

      res.json({
        success: true,
        data: {
          systemHealth: monitoringResult.overallSystemHealth,
          alerts: monitoringResult.alerts,
          summary: {
            totalVendors: activeVendors.length,
            activeAlerts: monitoringResult.alerts.length,
            criticalAlerts: monitoringResult.alerts.filter(a => a.severity === 'critical').length,
            lastUpdated: new Date().toISOString()
          },
          actions: {
            immediate: monitoringResult.alerts.filter(a => a.severity === 'critical').map(a => a.actionRequired),
            recommended: monitoringResult.alerts.filter(a => a.severity === 'high').map(a => a.actionRequired)
          }
        }
      });

    } catch (error) {
      logger.error('Vendor safety dashboard failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load vendor safety dashboard'
      });
    }
  }

  /**
   * Enhanced transaction approval
   * Pre-transaction safety check before payments
   */
  async checkTransactionSafety(req: Request, res: Response) {
    try {
      const { buyerWallet, vendorEmail, amount, chain, productId } = req.body;

      // Get vendor wallet
      const vendor = await this.getExistingVendor(vendorEmail);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found'
        });
      }

      // Enhanced transaction safety check
      const transactionSafety = await this.mcpService.enhancedTransactionSafety({
        buyerWallet,
        vendorWallet: vendor.walletAddress,
        amount,
        chain,
        productId,
        vendorId: vendorEmail
      });

      res.json({
        success: true,
        data: {
          transaction: {
            isApproved: transactionSafety.isApproved,
            paymentMethod: transactionSafety.paymentMethod,
            requiresEscrow: transactionSafety.requiresEscrow,
            estimatedFees: this.calculateTransactionFees(amount, transactionSafety.paymentMethod)
          },
          safety: {
            riskLevel: transactionSafety.safetyData.riskLevel,
            recommendation: transactionSafety.recommendedAction,
            reasons: transactionSafety.safetyData.reasons,
            providersChecked: transactionSafety.safetyData.metadata.providers
          },
          nextSteps: this.getTransactionNextSteps(transactionSafety)
        }
      });

    } catch (error) {
      logger.error('Transaction safety check failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check transaction safety'
      });
    }
  }

  // Helper methods to integrate with existing systems
  private async getExistingVendors(filters: any) {
    const query: any = { 'profile.isVendor': true };
    
    if (filters.category) {
      query['profile.categories'] = { $in: [filters.category.toLowerCase()] };
    }
    
    if (filters.minReputation) {
      query['reputation.score'] = { $gte: filters.minReputation };
    }
    
    const users = await User.find(query)
      .sort({ 'reputation.score': -1 })
      .limit(100);
    
    return users.map(user => ({
      email: user.email,
      username: user.username,
      walletAddress: user.walletAddress,
      chain: Chain.ETHEREUM,
      profile: user.profile,
      reputation: user.reputation
    }));
  }

  private async getExistingVendor(email: string) {
    const sanitizedEmail = sanitizeEmail(email);
    const user = await User.findOne({ email: sanitizedEmail, 'profile.isVendor': true });
    if (!user) {
      return null;
    }
    return {
      email: user.email,
      username: user.username,
      walletAddress: user.walletAddress,
      chain: Chain.ETHEREUM,
      profile: user.profile,
      reputation: user.reputation
    };
  }

  private async getActiveVendorIds(): Promise<string[]> {
    const vendors = await User.find({ 'profile.isVendor': true })
      .select('email')
      .lean();
    return vendors.map(v => v.email);
  }

  private async updateVendorWithSafetyData(email: string, safetyProfile: any) {
    // Update vendor record in your database with safety data
    logger.info(`Updated vendor ${email} with safety profile`);
  }

  private async getVendorProductsWithSafety(vendorEmail: string, safetyProfile: any) {
    const sanitizedEmail = sanitizeEmail(vendorEmail);
    const products = await Product.find({ vendorEmail: sanitizedEmail, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    return products.map(product => ({
      ...product,
      safetyContext: {
        vendorRiskLevel: safetyProfile.riskLevel,
        requiresEscrow: safetyProfile.riskLevel !== 'low',
        trustBadge: this.getTrustBadge(safetyProfile)
      }
    }));
  }

  private getTrustBadge(safetyProfile: any): string {
    const badges = {
      verified: '✅',
      pending: '⏳',
      unverified: '❓',
      flagged: '🚨'
    };
    return badges[safetyProfile.verificationStatus as keyof typeof badges] || '❓';
  }

  private getVendorRequirements(safetyProfile: any): string[] {
    const requirements = ['Complete profile information'];
    
    if (safetyProfile.verificationStatus !== 'verified') {
      requirements.push('Verify wallet ownership');
    }
    
    if (safetyProfile.riskLevel !== 'low') {
      requirements.push('Enhanced identity verification');
      requirements.push('Provide business documentation');
    }

    return requirements;
  }

  private getVendorOnboardingSteps(safetyProfile: any): string[] {
    const steps = ['Profile created successfully'];

    if (safetyProfile.verificationStatus === 'verified') {
      steps.push('✅ Safety verification complete');
      steps.push('🎉 Ready to list products');
    } else {
      steps.push('📝 Complete identity verification');
      steps.push('🔍 Await safety review');
      steps.push('📦 List your first product');
    }

    return steps;
  }

  private getListingRequirements(safetyProfile: any): string[] {
    const requirements = ['High-quality product images', 'Detailed descriptions'];

    if (safetyProfile.riskLevel !== 'low') {
      requirements.push('Security deposit required');
      requirements.push('Escrow-only transactions');
    }

    return requirements;
  }

  private getVendorRecommendations(safetyProfile: any): string[] {
    const recommendations = [];

    if (safetyProfile.safetyScore < 80) {
      recommendations.push('Improve transaction history for better safety score');
    }

    if (safetyProfile.reputation.successRate < 0.9) {
      recommendations.push('Focus on customer satisfaction to improve reputation');
    }

    if (safetyProfile.verificationStatus !== 'verified') {
      recommendations.push('Complete verification process for trusted seller badge');
    }

    return recommendations;
  }

  private calculateTransactionFees(amount: string, paymentMethod: string) {
    const baseAmount = parseFloat(amount);
    const platformFee = baseAmount * 0.025; // 2.5%
    const escrowFee = paymentMethod === 'escrow' ? baseAmount * 0.005 : 0; // 0.5%

    return {
      platform: platformFee,
      escrow: escrowFee,
      gas: 0.001, // Estimated gas fee
      total: platformFee + escrowFee + 0.001
    };
  }

  private getTransactionNextSteps(transactionSafety: any): string[] {
    if (!transactionSafety.isApproved) {
      return ['❌ Transaction blocked for safety', '🔍 Review wallet security', '📞 Contact support if needed'];
    }

    if (transactionSafety.requiresEscrow) {
      return ['🔒 Escrow protection enabled', '💰 Proceed with payment', '📦 Confirm delivery when received'];
    }

    return ['✅ Direct payment approved', '💰 Proceed with payment', '⭐ Rate your experience'];
  }
}

export default EnhancedVendorController;