import { BlockchainService, ProviderConfig } from './BlockchainService';

export class ReputationService extends BlockchainService {
  constructor(providerConfig: ProviderConfig, privateKey: string, reputationRegistryAddress: string) {
    const reputationRegistryABI = [
      "function updateReputation(address _user, uint256 _newReputation) external",
      "function getReputation(address _user) external view returns (uint256)"
    ];
    
    super(providerConfig, privateKey, reputationRegistryAddress, reputationRegistryABI);
  }

  async updateReputation(userAddress: string, newReputation: number): Promise<any> {
    return this.executeTransaction('updateReputation', userAddress, newReputation);
  }

  async getReputation(userAddress: string): Promise<number> {
    const reputation = await this.executeView('getReputation', userAddress);
    return Number(reputation);
  }
}
