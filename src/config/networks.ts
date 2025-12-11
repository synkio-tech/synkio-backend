export type NetworkKey = 'base_sepolia';

export interface NetworkConfig {
  key: NetworkKey;
  name: string;
  chainId: number;
  rpcUrl: string;
}

export const NETWORKS: NetworkConfig[] = [
  {
    key: 'base_sepolia',
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: process.env.BASE_RPC_URL || 'https://sepolia.base.org'
  }
];


