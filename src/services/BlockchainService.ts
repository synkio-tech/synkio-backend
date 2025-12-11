import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { NETWORKS } from '../config/networks';

export interface ProviderConfig {
  rpcUrl: string;
  chainId?: number;
  name: string;
  timeout?: number;
}

export class BlockchainService {
  protected contract: ethers.Contract;
  protected wallet: ethers.Wallet;
  protected provider: ethers.Provider;
  protected providerConfig: ProviderConfig;
  private static providerCache: Map<string, ethers.Provider> = new Map();

  constructor(
    providerConfig: ProviderConfig, 
    privateKey: string, 
    contractAddress: string,
    abi: string[]
  ) {
    this.providerConfig = providerConfig;
    this.provider = this.initializeProvider(providerConfig);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, abi, this.wallet);
    logger.info(`BlockchainService initialized with contract at ${contractAddress} on ${providerConfig.name}`);
  }

  /**
   * Initialize provider with caching and fallback support
   */
  private initializeProvider(config: ProviderConfig): ethers.Provider {
    const cacheKey = `${config.rpcUrl}-${config.chainId || 'default'}`;
    
    // Check cache first
    if (BlockchainService.providerCache.has(cacheKey)) {
      const cachedProvider = BlockchainService.providerCache.get(cacheKey)!;
      logger.info(`Using cached provider for ${config.name}`);
      return cachedProvider;
    }

    try {
      // Create provider with proper network configuration
      const providerOptions: any = {
        timeout: config.timeout || 10000
      };

      // Only add network config if chainId is provided and valid
      if (config.chainId && config.chainId > 0) {
        providerOptions.name = config.name;
        providerOptions.chainId = config.chainId;
      }

      const provider = new ethers.JsonRpcProvider(config.rpcUrl, providerOptions);

      // Cache the provider
      BlockchainService.providerCache.set(cacheKey, provider);
      logger.info(`Created new provider for ${config.name}: ${config.rpcUrl}`);
      
      return provider;
    } catch (error) {
      logger.error(`Failed to initialize provider for ${config.name}:`, error);
      throw new Error(`Provider initialization failed for ${config.name}`);
    }
  }

  /**
   * Test provider connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const network = await this.provider.getNetwork();
      logger.info(`Provider connection test successful. Network: ${network.name} (${network.chainId})`);
      return true;
    } catch (error) {
      logger.warn(`Provider connection test failed:`, error);
      return false;
    }
  }

  /**
   * Get provider with automatic fallback
   */
  async getProvider(): Promise<ethers.Provider> {
    const isConnected = await this.testConnection();
    
    if (isConnected) {
      return this.provider;
    }

    // Try to reconnect
    logger.warn(`Provider disconnected, attempting to reconnect...`);
    try {
      this.provider = this.initializeProvider(this.providerConfig);
      const reconnected = await this.testConnection();
      
      if (reconnected) {
        logger.info('Provider reconnected successfully');
        return this.provider;
      }
    } catch (error) {
      logger.error('Failed to reconnect provider:', error);
    }

    throw new Error('Provider connection failed and could not be restored');
  }

  /**
   * Get wallet balance with provider fallback
   */
  async getBalance(address?: string): Promise<string> {
    try {
      const provider = await this.getProvider();
      const targetAddress = address || this.wallet.address;
      const balance = await provider.getBalance(targetAddress);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Error getting balance:', error);
      throw new Error('Failed to get wallet balance');
    }
  }

  /**
   * Get network information
   */
  async getNetworkInfo(): Promise<{ name: string; chainId: number; rpcUrl: string }> {
    try {
      const provider = await this.getProvider();
      const network = await provider.getNetwork();
      return {
        name: network.name,
        chainId: Number(network.chainId),
        rpcUrl: this.providerConfig.rpcUrl
      };
    } catch (error) {
      logger.error('Error getting network info:', error);
      throw new Error('Failed to get network information');
    }
  }

  /**
   * Switch to a different provider configuration
   */
  async switchProvider(newConfig: ProviderConfig): Promise<void> {
    try {
      logger.info(`Switching provider from ${this.providerConfig.name} to ${newConfig.name}`);
      
      const newProvider = this.initializeProvider(newConfig);
      const isConnected = await this.testProviderConnection(newProvider);
      
      if (!isConnected) {
        throw new Error(`New provider ${newConfig.name} is not accessible`);
      }

      // Update provider and wallet
      this.providerConfig = newConfig;
      this.provider = newProvider;
      this.wallet = new ethers.Wallet(this.wallet.privateKey, this.provider);
      
      // Update contract with new provider
      this.contract = new ethers.Contract(
        this.contract.target as string,
        this.contract.interface.fragments,
        this.wallet
      );

      logger.info(`Successfully switched to provider: ${newConfig.name}`);
    } catch (error) {
      logger.error('Failed to switch provider:', error);
      throw new Error('Provider switch failed');
    }
  }

  /**
   * Test a specific provider connection
   */
  private async testProviderConnection(provider: ethers.Provider): Promise<boolean> {
    try {
      await provider.getNetwork();
      return true;
    } catch (error) {
      logger.warn('Provider connection test failed:', error);
      return false;
    }
  }

  /**
   * Get multiple provider configurations for fallback
   */
  static getProviderConfigs(): ProviderConfig[] {
    return NETWORKS.map((network) => ({
      rpcUrl: network.rpcUrl,
      chainId: network.chainId,
      name: network.name,
      timeout: 10000
    }));
  }

  /**
   * Create BlockchainService with automatic provider selection
   */
  static async createWithFallback(
    privateKey: string,
    contractAddress: string,
    abi: string[]
  ): Promise<BlockchainService> {
    const configs = this.getProviderConfigs();
    
    for (const config of configs) {
      try {
        logger.info(`Attempting to connect to ${config.name}...`);
        const service = new BlockchainService(config, privateKey, contractAddress, abi);
        
        const isConnected = await service.testConnection();
        if (isConnected) {
          logger.info(`Successfully connected to ${config.name}`);
          return service;
        }
      } catch (error) {
        logger.warn(`Failed to connect to ${config.name}:`, error);
        continue;
      }
    }

    throw new Error('No accessible providers found');
  }

  protected async executeTransaction(method: string, ...args: any[]): Promise<ethers.ContractTransactionResponse> {
    try {
      const tx = await (this.contract as any)[method](...args);
      logger.info(`Transaction ${method} executed: ${tx.hash}`);
      return tx;
    } catch (error: any) {
      logger.error(`Transaction ${method} failed: ${error.message}`);
      throw error;
    }
  }

  protected async executeView(method: string, ...args: any[]): Promise<any> {
    try {
      const result = await (this.contract as any)[method](...args);
      logger.info(`View ${method} executed successfully`);
      return result;
    } catch (error: any) {
      logger.error(`View ${method} failed: ${error.message}`);
      throw error;
    }
  }
}
