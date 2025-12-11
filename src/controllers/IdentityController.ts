import { Request, Response } from 'express';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware';
import { ApiResponse } from '../types';
import { WalletService } from '../services/WalletService';
import { ethers } from 'ethers';
import bcrypt from 'bcryptjs';
import { sanitizeString, sanitizeEmail, sanitizeUrl, containsScriptTags } from '../utils/sanitize';

export class IdentityController {
  private static walletService = new WalletService();
  private static provider: ethers.Provider | null = null;

  private static initializeProvider(): ethers.Provider | null {
    if (this.provider) {
      return this.provider;
    }

    const rpcUrl = process.env.BASE_RPC_URL;
    if (!rpcUrl) {
      logger.warn('BASE_RPC_URL not set, wallet balance will use fallback');
      return null;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      logger.info(`Initialized RPC provider with URL: ${rpcUrl}`);
      return this.provider;
    } catch (error) {
      logger.warn('Failed to initialize RPC provider:', error);
      return null;
    }
  }

  static createUser = asyncHandler(async (req: Request, res: Response) => {
    const { email, username, password, profile, consentGiven, phoneNumber } = req.body;
    
    if (containsScriptTags(email) || containsScriptTags(username) || 
        (profile?.name && containsScriptTags(profile.name)) ||
        (profile?.bio && containsScriptTags(profile.bio)) ||
        (profile?.location && containsScriptTags(profile.location))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid characters detected in input'
      });
    }
    
    const sanitizedEmail = sanitizeEmail(email);
    
    // Check if user already exists by email
    const existingUserByEmail = await User.findOne({ email: sanitizedEmail });
    if (existingUserByEmail) {
      return res.status(400).json({ 
        success: false,
        error: 'User with this email already exists' 
      });
    }

    const sanitizedUsername = username ? sanitizeString(username) : '';
    const normalizedUsername = sanitizedUsername && !sanitizedUsername.toLowerCase().endsWith('.synkio') 
      ? `${sanitizedUsername.toLowerCase().trim()}.synkio` 
      : (sanitizedUsername?.toLowerCase().trim() || '');

    // Check if username already exists
    const existingUserByUsername = await User.findOne({ username: normalizedUsername });
    if (existingUserByUsername) {
      return res.status(400).json({ 
        success: false,
        error: 'Username already taken' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create wallet with password-based encryption
    const { address: walletAddress, encryptedPrivateKey } = await IdentityController.walletService.createWallet(hashedPassword);

    const user = new User({
      email: sanitizedEmail,
      username: normalizedUsername,
      password: hashedPassword,
      walletAddress,
      encryptedPrivateKey,
      consentGiven: consentGiven || false,
      onboardingCompleted: true,
      phoneNumber: phoneNumber ? sanitizeString(phoneNumber) : undefined,
      profile: {
        name: profile?.name ? sanitizeString(profile.name) : '',
        bio: profile?.bio ? sanitizeString(profile.bio) : undefined,
        isVendor: profile?.isVendor || false,
        categories: profile?.categories || [],
        avatar: profile?.avatar ? sanitizeUrl(profile.avatar) : undefined,
        location: profile?.location ? sanitizeString(profile.location) : undefined,
        website: profile?.website ? sanitizeUrl(profile.website) : undefined
      }
    });

    await user.save();
    
    const response: ApiResponse = {
      success: true,
      message: 'User created successfully',
      data: {
        email: user.email,
        username: user.username,
        walletAddress: user.walletAddress,
        profile: user.profile,
        onboardingCompleted: user.onboardingCompleted
      }
    };
    
    res.status(201).json(response);
  });

  static signIn = asyncHandler(async (req: Request, res: Response) => {
    const { email, username, password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    let user;
    if (email) {
      const sanitizedEmail = sanitizeEmail(email);
      user = await User.findOne({ email: sanitizedEmail });
    } else if (username) {
      const normalizedUsername = username.toLowerCase().endsWith('.synkio') 
        ? username.toLowerCase().trim()
        : `${username.toLowerCase().trim()}.synkio`;
      user = await User.findOne({ username: normalizedUsername });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Email or username is required'
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email/username or password'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email/username or password'
      });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Sign in successful',
      data: {
        email: user.email,
        username: user.username,
        walletAddress: user.walletAddress,
        profile: user.profile,
        onboardingCompleted: user.onboardingCompleted
      }
    };

    res.status(200).json(response);
  });

  static getUser = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.params;
    const sanitizedEmail = sanitizeEmail(email);
    const user = await User.findOne({ email: sanitizedEmail });
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        email: user.email,
        walletAddress: user.walletAddress,
        profile: user.profile,
        onboardingCompleted: user.onboardingCompleted,
        consentGiven: user.consentGiven,
        reputation: user.reputation
      }
    };

    res.status(200).json(response);
  });

  static checkOnboarding = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.params;
    const sanitizedEmail = sanitizeEmail(email);
    const user = await User.findOne({ email: sanitizedEmail });
    
    const response: ApiResponse = {
      success: true,
      data: {
        exists: !!user,
        onboardingCompleted: user?.onboardingCompleted || false,
        user: user ? {
          email: user.email,
          profile: user.profile,
          walletAddress: user.walletAddress
        } : null
      }
    };

    res.status(200).json(response);
  });

  static completeOnboarding = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.params;
    const { consentGiven } = req.body;
    const sanitizedEmail = sanitizeEmail(email);
    
    const user = await User.findOneAndUpdate(
      { email: sanitizedEmail },
      { 
        onboardingCompleted: true,
        consentGiven: consentGiven || false
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        email: user.email,
        onboardingCompleted: user.onboardingCompleted,
        consentGiven: user.consentGiven
      }
    };

    res.status(200).json(response);
  });

  static getWalletBalance = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.params;
    const sanitizedEmail = sanitizeEmail(email);
    const user = await User.findOne({ email: sanitizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.encryptedPrivateKey) {
      logger.error('User missing encrypted private key:', { email: sanitizedEmail });
      return res.status(500).json({
        success: false,
        error: 'Wallet not initialized - encrypted private key missing'
      });
    }

    if (!user.password) {
      logger.error('User missing password hash:', { email: sanitizedEmail });
      return res.status(500).json({
        success: false,
        error: 'Wallet not initialized - password hash missing'
      });
    }

    try {
      const provider = IdentityController.initializeProvider();
      const balance = await IdentityController.walletService.getWalletBalance(
        user.encryptedPrivateKey, 
        user.password, 
        provider || undefined
      );

      let networkInfo = { name: 'Base Sepolia', chainId: 84532 };
      if (provider) {
        try {
          const network = await provider.getNetwork();
          networkInfo = {
            name: network.name,
            chainId: Number(network.chainId)
          };
        } catch (error) {
          logger.warn('Could not get network info, using defaults:', error);
        }
      }

      const response: ApiResponse = {
        success: true,
        data: {
          walletAddress: user.walletAddress,
          balance: balance,
          currency: 'ETH',
          network: networkInfo
        }
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error('Error getting wallet balance:', {
        email: sanitizedEmail,
        walletAddress: user.walletAddress,
        error: error.message,
        code: error.code,
        hasEncryptedKey: !!user.encryptedPrivateKey,
        hasPassword: !!user.password
      });

      const errorMessage = error.message || 'Failed to get wallet balance';
      const statusCode = error.message?.includes('ENCRYPTION_KEY') || error.message?.includes('password hash') 
        ? 500 
        : 500;

      res.status(statusCode).json({
        success: false,
        error: errorMessage.includes('ENCRYPTION_KEY') 
          ? 'Wallet decryption failed - encryption key mismatch. Please contact support.'
          : errorMessage.includes('password hash')
          ? 'Wallet decryption failed - password hash mismatch. Account may need to be re-initialized.'
          : 'Failed to get wallet balance'
      });
    }
  });

  static linkFarcaster = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.params;
    const sanitizedEmail = sanitizeEmail(email);
    
    const user = await User.findOne({ email: sanitizedEmail });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Farcaster linking is not currently supported in the schema
    // This method is kept for API compatibility but does not persist farcasterFid
    const response: ApiResponse = {
      success: true,
      message: 'Farcaster linking is not currently supported',
      data: user
    };

    res.status(200).json(response);
  });

  static updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.params;
    const { profile } = req.body;
    
    if (profile && (
      (profile.name && containsScriptTags(profile.name)) ||
      (profile.bio && containsScriptTags(profile.bio)) ||
      (profile.location && containsScriptTags(profile.location))
    )) {
      return res.status(400).json({
        success: false,
        error: 'Invalid characters detected in profile data'
      });
    }
    
    const sanitizedProfile = profile ? {
      ...profile,
      name: profile.name ? sanitizeString(profile.name) : profile.name,
      bio: profile.bio ? sanitizeString(profile.bio) : profile.bio,
      location: profile.location ? sanitizeString(profile.location) : profile.location,
      avatar: profile.avatar ? sanitizeUrl(profile.avatar) : profile.avatar,
      website: profile.website ? sanitizeUrl(profile.website) : profile.website
    } : profile;
    
    const sanitizedEmail = sanitizeEmail(email);
    const user = await User.findOneAndUpdate(
      { email: sanitizedEmail },
      { profile: sanitizedProfile },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Profile updated successfully',
      data: user
    };

    res.status(200).json(response);
  });

  static createVendor = asyncHandler(async (req: Request, res: Response) => {
    const { email, username, password, profile, consentGiven, phoneNumber } = req.body;
    
    if (containsScriptTags(email) || containsScriptTags(username) || 
        (profile?.name && containsScriptTags(profile.name)) ||
        (profile?.bio && containsScriptTags(profile.bio)) ||
        (profile?.location && containsScriptTags(profile.location))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid characters detected in input'
      });
    }
    
    const sanitizedEmail = sanitizeEmail(email);
    
    // Check if user already exists by email
    const existingUserByEmail = await User.findOne({ email: sanitizedEmail });
    if (existingUserByEmail) {
      return res.status(400).json({ 
        success: false,
        error: 'User with this email already exists' 
      });
    }

    const sanitizedUsername = username ? sanitizeString(username) : '';
    const normalizedUsername = sanitizedUsername && !sanitizedUsername.toLowerCase().endsWith('.synkio') 
      ? `${sanitizedUsername.toLowerCase().trim()}.synkio` 
      : (sanitizedUsername?.toLowerCase().trim() || '');

    // Check if username already exists
    const existingUserByUsername = await User.findOne({ username: normalizedUsername });
    if (existingUserByUsername) {
      return res.status(400).json({ 
        success: false,
        error: 'Username already taken' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create wallet with password-based encryption
    const { address: walletAddress, encryptedPrivateKey } = await IdentityController.walletService.createWallet(hashedPassword);

    const user = new User({
      email: sanitizedEmail,
      username: normalizedUsername,
      password: hashedPassword,
      walletAddress,
      encryptedPrivateKey,
      consentGiven: consentGiven || false,
      onboardingCompleted: true,
      phoneNumber: phoneNumber ? sanitizeString(phoneNumber) : undefined,
      profile: {
        name: profile?.name ? sanitizeString(profile.name) : '',
        bio: profile?.bio ? sanitizeString(profile.bio) : undefined,
        isVendor: true,
        categories: profile?.categories || [],
        avatar: profile?.avatar ? sanitizeUrl(profile.avatar) : undefined,
        location: profile?.location ? sanitizeString(profile.location) : undefined,
        website: profile?.website ? sanitizeUrl(profile.website) : undefined
      }
    });

    await user.save();
    
    const response: ApiResponse = {
      success: true,
      message: 'Vendor created successfully',
      data: {
        email: user.email,
        username: user.username,
        walletAddress: user.walletAddress,
        profile: user.profile,
        onboardingCompleted: user.onboardingCompleted
      }
    };
    
    res.status(201).json(response);
  });

  static updateVendor = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.params;
    const { profile } = req.body;
    const sanitizedEmail = sanitizeEmail(email);
    
    const user = await User.findOneAndUpdate(
      { email: sanitizedEmail, 'profile.isVendor': true },
      { 
        profile: {
          ...profile,
          isVendor: true // Ensure vendor status is maintained
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'Vendor not found' 
      });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Vendor profile updated successfully',
      data: {
        email: user.email,
        profile: user.profile
      }
    };

    res.status(200).json(response);
  });

  static getVendor = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.params;
    const sanitizedEmail = sanitizeEmail(email);
    const user = await User.findOne({ email: sanitizedEmail, 'profile.isVendor': true });
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'Vendor not found' 
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        email: user.email,
        username: user.username,
        walletAddress: user.walletAddress,
        profile: user.profile,
        reputation: user.reputation
      }
    };

    res.status(200).json(response);
  });

  static getVendors = asyncHandler(async (req: Request, res: Response) => {
    const { category, minReputation = 0, page = 1, limit = 20 } = req.query;
    
    const query: any = {
      'profile.isVendor': true,
      'reputation.score': { $gte: Number(minReputation) }
    };
    
    if (category) {
      query['profile.categories'] = category;
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const vendors = await User.find(query)
      .sort({ 'reputation.score': -1 })
      .skip(skip)
      .limit(Number(limit));
    
    const total = await User.countDocuments(query);

    const response: ApiResponse = {
      success: true,
      data: {
        vendors: vendors.map(vendor => ({
          id: vendor._id,
          email: vendor.email,
          username: vendor.username,
          walletAddress: vendor.walletAddress,
          profile: vendor.profile,
          reputation: vendor.reputation
        })),
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
}