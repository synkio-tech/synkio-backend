import { Router } from 'express';
import { NETWORKS } from '../config/networks';

const router = Router();

router.get('/', (req, res) => {
  const result = NETWORKS.map((network) => ({
    key: network.key,
    name: network.name,
    chainId: network.chainId,
    rpcUrl: network.rpcUrl
  }));

  res.status(200).json({
    success: true,
    networks: result
  });
});

export default router;


