import { BlockchainService, ProviderConfig } from './BlockchainService';
import { ethers } from 'ethers';

export class DisputeService extends BlockchainService {
  constructor(providerConfig: ProviderConfig, privateKey: string, disputeResolutionAddress: string) {
    const disputeResolutionABI = [
      "function openDispute(bytes32 _escrowId, string calldata _evidence) external",
      "function addEvidence(bytes32 _escrowId, string calldata _evidence) external",
      "function resolveDispute(bytes32 _escrowId, address _winner) external",
      "function disputes(bytes32) external view returns (bytes32 escrowId, address buyer, address seller, uint256 amount, address token, uint8 status, string buyerEvidence, string sellerEvidence)"
    ];
    
    super(providerConfig, privateKey, disputeResolutionAddress, disputeResolutionABI);
  }

  async openDispute(escrowId: string, evidence: string): Promise<any> {
    return this.executeTransaction('openDispute', escrowId, evidence);
  }

  async addEvidence(escrowId: string, evidence: string): Promise<any> {
    return this.executeTransaction('addEvidence', escrowId, evidence);
  }

  async resolveDispute(escrowId: string, winnerAddress: string): Promise<any> {
    return this.executeTransaction('resolveDispute', escrowId, winnerAddress);
  }

  async getDispute(escrowId: string): Promise<any> {
    const dispute = await this.executeView('disputes', escrowId);
    return {
      escrowId: dispute.escrowId,
      buyer: dispute.buyer,
      seller: dispute.seller,
      amount: ethers.formatEther(dispute.amount),
      token: dispute.token,
      status: Number(dispute.status),
      buyerEvidence: dispute.buyerEvidence,
      sellerEvidence: dispute.sellerEvidence,
    };
  }
}
