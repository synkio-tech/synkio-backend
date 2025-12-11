import { ethers } from 'ethers';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

export class WalletService {
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
    if (this.encryptionKey === 'default-key-change-in-production') {
      logger.warn('Using default encryption key. Change ENCRYPTION_KEY in production!');
    }
  }

  /**
   * Create a new wallet with encrypted private key storage
   * Uses password hash as additional encryption layer
   */
  async createWallet(passwordHash: string): Promise<{ address: string; encryptedPrivateKey: string }> {
    try {
      // Generate new wallet
      const wallet = ethers.Wallet.createRandom();
      const privateKey = wallet.privateKey;
      const address = wallet.address;

      // Encrypt private key with password hash
      const encryptedPrivateKey = this.encryptPrivateKey(privateKey, passwordHash);

      logger.info(`Created new wallet: ${address}`);

      return {
        address,
        encryptedPrivateKey
      };
    } catch (error) {
      logger.error('Error creating wallet:', error);
      throw new Error('Failed to create wallet');
    }
  }

  /**
   * Decrypt private key for wallet operations
   * Requires password hash for decryption (two-factor encryption)
   */
  decryptPrivateKey(encryptedPrivateKey: string, passwordHash: string): string {
    try {
      if (!encryptedPrivateKey || typeof encryptedPrivateKey !== 'string') {
        throw new Error('Encrypted private key is required and must be a string');
      }

      if (!passwordHash || typeof passwordHash !== 'string') {
        throw new Error('Password hash is required for decryption');
      }

      if (this.encryptionKey === 'default-key-change-in-production') {
        logger.warn('Using default encryption key - this may cause decryption failures if key was changed');
      }

      const algorithm = 'aes-256-cbc';
      
      const parts = encryptedPrivateKey.split(':');
      if (parts.length !== 2) {
        logger.error(`Invalid encrypted key format. Expected format: "iv:encrypted", got: ${encryptedPrivateKey.substring(0, 20)}...`);
        throw new Error('Invalid encrypted private key format - expected "iv:encrypted" format');
      }

      if (parts[0].length !== 32 || !/^[0-9a-f]+$/i.test(parts[0])) {
        logger.error(`Invalid IV format. IV must be 32 hex characters, got: ${parts[0].length} chars`);
        throw new Error('Invalid IV format in encrypted private key');
      }

      if (parts[1].length === 0 || !/^[0-9a-f]+$/i.test(parts[1])) {
        logger.error(`Invalid encrypted data format. Encrypted data must be hex string, got: ${parts[1].length} chars`);
        throw new Error('Invalid encrypted data format in private key');
      }

      const iv = Buffer.from(parts[0], 'hex');
      if (iv.length !== 16) {
        throw new Error(`Invalid IV length: expected 16 bytes, got ${iv.length}`);
      }

      const encrypted = Buffer.from(parts[1], 'hex');
      if (encrypted.length === 0) {
        throw new Error('Encrypted data is empty');
      }
      
      const combinedKey = crypto.createHash('sha256')
        .update(this.encryptionKey + passwordHash)
        .digest('hex');
      
      const key = crypto.scryptSync(combinedKey, 'salt', 32);
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      if (!decrypted || decrypted.length === 0) {
        throw new Error('Decryption resulted in empty private key');
      }

      if (!decrypted.startsWith('0x') || decrypted.length !== 66) {
        logger.warn(`Decrypted key format may be invalid. Expected 66-char hex string starting with 0x, got: ${decrypted.length} chars`);
      }

      return decrypted;
    } catch (error: any) {
      if (error.code === 'ERR_OSSL_BAD_DECRYPT') {
        logger.error('Decryption failed - possible causes:', {
          error: error.message,
          hasEncryptionKey: !!this.encryptionKey,
          encryptionKeyLength: this.encryptionKey?.length || 0,
          passwordHashLength: passwordHash?.length || 0,
          encryptedKeyFormat: encryptedPrivateKey?.split(':').length || 0,
          encryptedKeyLength: encryptedPrivateKey?.length || 0
        });
        throw new Error('Failed to decrypt private key - ENCRYPTION_KEY may have changed or password hash mismatch');
      }
      
      if (error.message.includes('Invalid') || error.message.includes('format')) {
        logger.error('Invalid encrypted key format:', {
          error: error.message,
          keyPreview: encryptedPrivateKey?.substring(0, 50) || 'null'
        });
        throw error;
      }

      logger.error('Error decrypting private key:', {
        error: error.message,
        code: error.code,
        stack: error.stack
      });
      throw new Error(`Failed to decrypt private key: ${error.message}`);
    }
  }

  /**
   * Encrypt private key for secure storage
   * Uses password hash as additional encryption factor
   */
  private encryptPrivateKey(privateKey: string, passwordHash: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      
      // Combine master key and password hash for enhanced security
      const combinedKey = crypto.createHash('sha256')
        .update(this.encryptionKey + passwordHash)
        .digest('hex');
      
      const key = crypto.scryptSync(combinedKey, 'salt', 32);
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv(algorithm, key, iv);

      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Combine IV and encrypted data
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      logger.error('Error encrypting private key:', error);
      throw new Error('Failed to encrypt private key');
    }
  }

  /**
   * Get wallet instance from encrypted private key
   * Requires password hash for decryption
   */
  getWallet(encryptedPrivateKey: string, passwordHash: string): ethers.Wallet {
    try {
      const privateKey = this.decryptPrivateKey(encryptedPrivateKey, passwordHash);
      
      try {
        const wallet = new ethers.Wallet(privateKey);
        return wallet;
      } catch (walletError: any) {
        logger.error('Failed to create wallet from decrypted key:', {
          error: walletError.message,
          keyLength: privateKey?.length || 0,
          keyPreview: privateKey?.substring(0, 10) || 'null'
        });
        throw new Error('Decrypted private key is invalid - key may be corrupted');
      }
    } catch (error: any) {
      if (error.message.includes('ENCRYPTION_KEY') || error.message.includes('password hash')) {
        throw error;
      }
      logger.error('Error getting wallet:', {
        error: error.message,
        code: error.code
      });
      throw new Error(`Failed to get wallet: ${error.message}`);
    }
  }

  /**
   * Get wallet balance with fallback handling
   * Requires password hash for decryption
   */
  async getWalletBalance(encryptedPrivateKey: string, passwordHash: string, provider?: ethers.Provider): Promise<string> {
    try {
      if (!encryptedPrivateKey) {
        throw new Error('Encrypted private key is required');
      }
      if (!passwordHash) {
        throw new Error('Password hash is required for decryption');
      }

      const wallet = this.getWallet(encryptedPrivateKey, passwordHash);
      
      if (provider) {
        try {
          const balance = await provider.getBalance(wallet.address);
          return ethers.formatEther(balance);
        } catch (providerError: any) {
          logger.warn('Provider failed to get balance, using fallback:', {
            address: wallet.address,
            error: providerError.message
          });
        }
      }
      
      logger.warn(`Using fallback balance (0.0) for wallet ${wallet.address}`);
      return '0.0';
      
    } catch (error: any) {
      logger.error('Error getting wallet balance:', {
        error: error.message,
        code: error.code,
        hasEncryptedKey: !!encryptedPrivateKey,
        hasPasswordHash: !!passwordHash
      });
      
      if (error.message.includes('ENCRYPTION_KEY') || error.message.includes('password hash')) {
        throw error;
      }
      
      throw new Error(`Failed to get wallet balance: ${error.message}`);
    }
  }

  /**
   * Validate wallet address format
   */
  isValidAddress(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }
}
