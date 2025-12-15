import 'reflect-metadata';
import express from 'express';
import { createServer } from 'http';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware';

// Import config
import { CONTRACT_ADDRESSES } from './config/contracts';

// Import services
import { EscrowService } from './services/EscrowService';
import { PaymentService } from './services/PaymentService';
import { ReputationService } from './services/ReputationService';
import { DisputeService } from './services/DisputeService';
import { WebSocketService } from './services/WebSocketService';
import { setWebSocketService } from './services/websocket';

// Import routes
import identityRoutes from './routes/identity';
import vendorRoutes from './routes/vendors';
import escrowRoutes, { initializeEscrowRoutes } from './routes/escrow';
import transactionRoutes, { initializeTransactionRoutes } from './routes/transactions';
import reputationRoutes, { initializeReputationRoutes } from './routes/reputation';
import feedbackRoutes from './routes/feedback';
import conversationRoutes from './routes/conversations';
import networkRoutes from './routes/networks';
import categoryRoutes from './routes/categories';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const port = process.env.BACKEND_PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: '*'
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Database connection
mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/synkio')
  .then(() => logger.info('Connected to MongoDB'))
  .catch((error) => {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Initialize blockchain services
const privateKey = process.env.PRIVATE_KEY;

if (!privateKey) {
  logger.error("Missing PRIVATE_KEY environment variable. Please check .env file.");
  process.exit(1);
}

const escrowManagerAddress = CONTRACT_ADDRESSES.ESCROW_MANAGER;
const paymentProcessorAddress = CONTRACT_ADDRESSES.PAYMENT_PROCESSOR;
const reputationRegistryAddress = CONTRACT_ADDRESSES.REPUTATION_REGISTRY;
const disputeResolutionAddress = CONTRACT_ADDRESSES.DISPUTE_RESOLUTION;

// Create provider configuration for Base Sepolia testnet
const providerConfig = {
  rpcUrl: process.env.BASE_RPC_URL || 'https://sepolia.base.org',
  chainId: 84532,
  name: 'Base Sepolia',
  timeout: 10000
};

// Initialize services with error handling
let escrowService, paymentService, reputationService, disputeService;

try {
  escrowService = new EscrowService(providerConfig, privateKey, escrowManagerAddress);
  paymentService = new PaymentService(providerConfig, privateKey, paymentProcessorAddress);
  reputationService = new ReputationService(providerConfig, privateKey, reputationRegistryAddress);
  disputeService = new DisputeService(providerConfig, privateKey, disputeResolutionAddress);
  
  logger.info('Blockchain services initialized successfully');
} catch (error) {
  logger.error('Failed to initialize blockchain services:', error);
  logger.warn('Services will be initialized with fallback configuration');
  
  // Fallback configuration for Base Sepolia testnet
  const fallbackConfig = {
    rpcUrl: 'https://sepolia.base.org',
    chainId: 84532,
    name: 'Base Sepolia',
    timeout: 15000
  };
  
  escrowService = new EscrowService(fallbackConfig, privateKey, escrowManagerAddress);
  paymentService = new PaymentService(fallbackConfig, privateKey, paymentProcessorAddress);
  reputationService = new ReputationService(fallbackConfig, privateKey, reputationRegistryAddress);
  disputeService = new DisputeService(fallbackConfig, privateKey, disputeResolutionAddress);
}

// Initialize route controllers with services
initializeEscrowRoutes(escrowService, disputeService);
initializeTransactionRoutes(paymentService, reputationService);
initializeReputationRoutes(reputationService);

// API Routes
app.use('/api/identity', identityRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reputation', reputationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/networks', networkRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/waitlist', waitlistRoutes);

// Initialize WebSocket service
const wsService = new WebSocketService(httpServer);
setWebSocketService(wsService);

// Health check
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Synkio Backend Service is running!',
    version: '1.0.0',
    services: ['identity', 'escrow', 'payment', 'reputation', 'transactions', 'vendors', 'feedback', 'websocket'],
    websocket: {
      connectedClients: wsService.getConnectedClients(),
      enabled: true
    }
  });
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

httpServer.listen(port, () => {
  logger.info(`Synkio Backend Service listening on port ${port}`);
  logger.info(`WebSocket server enabled and ready for connections`);
});