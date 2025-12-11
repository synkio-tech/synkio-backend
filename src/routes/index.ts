import express, { Router } from 'express';  
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { errorHandler, notFoundHandler } from '../middleware';

// Import config
import { CONTRACT_ADDRESSES } from '../config/contracts';

// Import services
import { EscrowService } from '../services/EscrowService';
import { PaymentService } from '../services/PaymentService';
import { ReputationService } from '../services/ReputationService';
import { DisputeService } from '../services/DisputeService';

// Import routes
import identityRoutes from './identity';
import escrowRoutes, { initializeEscrowRoutes } from './escrow';
import transactionRoutes, { initializeTransactionRoutes } from './transactions';
import reputationRoutes, { initializeReputationRoutes } from './reputation';
import productRoutes from './products';
import vendorRoutes from './vendors';
import enhancedVendorRoutes from './enhanced-vendors';
import conversationRoutes from './conversations';
import categoryRoutes from './categories';

dotenv.config();

const app = Router();
const port = process.env.BACKEND_PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors());
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

const escrowService = new EscrowService(providerConfig, privateKey, escrowManagerAddress);
const paymentService = new PaymentService(providerConfig, privateKey, paymentProcessorAddress);
const reputationService = new ReputationService(providerConfig, privateKey, reputationRegistryAddress);
const disputeService = new DisputeService(providerConfig, privateKey, disputeResolutionAddress);

// Initialize route controllers with services
initializeEscrowRoutes(escrowService, disputeService);
initializeTransactionRoutes(paymentService, reputationService);
initializeReputationRoutes(reputationService);

// API Routes
app.use('/api/identity', identityRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reputation', reputationRoutes);
app.use('/api/products', productRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/enhanced-vendors', enhancedVendorRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/categories', categoryRoutes);

// Health check
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Synkio Backend Service is running!',
    version: '1.0.0',
    services: ['identity', 'escrow', 'payment', 'reputation', 'transactions', 'vendors', 'products']
  });
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
