import { BlockchainService, ProviderConfig } from './BlockchainService';
import { logger } from '../utils/logger';
import { ethers } from 'ethers';

export class EscrowService extends BlockchainService {
  constructor(providerConfig: ProviderConfig, privateKey: string, escrowManagerAddress: string) {
    const escrowManagerABI = [
      "function createEscrow(address seller, string memory description, bytes32 metadataHash, tuple(uint256 amount, string description, bool completed, uint256 completedAt)[] _milestones, address token, uint256 amount) external payable returns (uint256)",
      "function releasePayment(uint256 escrowId, uint256 milestoneIndex) external",
      "function fileDispute(uint256 escrowId, string memory reason) external",
      "function cancelEscrow(uint256 escrowId) external",
      "function fundEscrow(uint256 escrowId) external payable",
      "function getEscrow(uint256 escrowId) external view returns (tuple(uint256 id, address buyer, address seller, uint256 amount, uint256 platformFee, uint256 createdAt, uint256 expiresAt, uint8 status, string description, bytes32 metadataHash, address token))",
      "function getMilestones(uint256 escrowId) external view returns (tuple(uint256 amount, string description, bool completed, uint256 completedAt)[])",
      "function supportedTokens(address) external view returns (bool)",
      "event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount)"
    ];
    
    super(providerConfig, privateKey, escrowManagerAddress, escrowManagerABI);
  }

  async createEscrow(
    seller: string,
    description: string,
    metadataHash: string,
    milestones: Array<{ amount: string; description: string; completed: boolean; completedAt: number }>,
    token: string,
    amount: string
  ): Promise<any> {
    logger.info(`Creating escrow: buyer=${this.wallet.address}, seller=${seller}, amount=${amount}, token=${token}`);
    
    const parsedAmount = ethers.parseEther(amount);
    const parsedMetadataHash = ethers.hexlify(metadataHash);
    
    const parsedMilestones = milestones.map(m => ({
      amount: ethers.parseEther(m.amount),
      description: m.description,
      completed: m.completed,
      completedAt: BigInt(m.completedAt)
    }));
    
    if (token === ethers.ZeroAddress) {
      return this.executeTransaction('createEscrow', seller, description, parsedMetadataHash, parsedMilestones, token, parsedAmount, { value: parsedAmount });
    } else {
      const IERC20 = new ethers.Interface([
        "function approve(address spender, uint256 amount) external returns (bool)"
      ]);
      const tokenContract = new ethers.Contract(token, IERC20, this.wallet);
      await tokenContract.approve(this.contract.target, parsedAmount);
      return this.executeTransaction('createEscrow', seller, description, parsedMetadataHash, parsedMilestones, token, parsedAmount);
    }
  }

  async releasePayment(escrowId: number, milestoneIndex: number): Promise<any> {
    logger.info(`Releasing payment: escrowId=${escrowId}, milestoneIndex=${milestoneIndex}`);
    return this.executeTransaction('releasePayment', escrowId, milestoneIndex);
  }

  async fileDispute(escrowId: number, reason: string): Promise<any> {
    logger.info(`Filing dispute: escrowId=${escrowId}, reason=${reason}`);
    return this.executeTransaction('fileDispute', escrowId, reason);
  }

  async cancelEscrow(escrowId: number): Promise<any> {
    logger.info(`Cancelling escrow: ${escrowId}`);
    return this.executeTransaction('cancelEscrow', escrowId);
  }

  async fundEscrow(escrowId: number, amount: string): Promise<any> {
    logger.info(`Funding escrow: escrowId=${escrowId}, amount=${amount}`);
    const parsedAmount = ethers.parseEther(amount);
    return this.executeTransaction('fundEscrow', escrowId, { value: parsedAmount });
  }

  async getEscrow(escrowId: number): Promise<any> {
    logger.info(`Fetching escrow: ${escrowId}`);
    const escrow = await this.executeView('getEscrow', escrowId);
    return {
      id: Number(escrow.id),
      buyer: escrow.buyer,
      seller: escrow.seller,
      amount: ethers.formatEther(escrow.amount),
      platformFee: ethers.formatEther(escrow.platformFee),
      createdAt: Number(escrow.createdAt),
      expiresAt: Number(escrow.expiresAt),
      status: Number(escrow.status),
      description: escrow.description,
      metadataHash: escrow.metadataHash,
      token: escrow.token
    };
  }

  async getMilestones(escrowId: number): Promise<any> {
    logger.info(`Fetching milestones: ${escrowId}`);
    const milestones = await this.executeView('getMilestones', escrowId);
    return milestones.map((m: any) => ({
      amount: ethers.formatEther(m.amount),
      description: m.description,
      completed: m.completed,
      completedAt: Number(m.completedAt)
    }));
  }

  async isTokenSupported(tokenAddress: string): Promise<boolean> {
    logger.info(`Checking token support: ${tokenAddress}`);
    return await this.executeView('supportedTokens', tokenAddress);
  }
}
