import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: Number(process.env.BACKEND_PORT) || 4000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  
  database: {
    url: process.env.DATABASE_URL || 'mongodb://localhost:27017/synkio',
  },
  
  blockchain: {
    baseRpcUrl: process.env.BASE_RPC_URL || 'https://sepolia.base.org',
    baseSepoliaRpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    privateKey: process.env.PRIVATE_KEY || '',
  },
  
  email: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    fromAddress: 'Synkio <info@synkio.app>',
  },
  
  external: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    wasenderApiKey: process.env.WASENDER_API_KEY,
    neynarApiKey: process.env.NEYNAR_API_KEY,
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  auth: {
    jwtSecret: process.env.JWT_SECRET || '',
    encryptionKey: process.env.ENCRYPTION_KEY || '',
  },
  
  oauth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  
  mcp: {
    transport: (process.env.MCP_TRANSPORT || 'stdio') as 'stdio' | 'sse',
    safetyServer: {
      url: process.env.MCP_SAFETY_SERVER_URL,
      command: process.env.MCP_SAFETY_SERVER_COMMAND || 'npx',
      args: process.env.MCP_SAFETY_SERVER_ARGS 
        ? process.env.MCP_SAFETY_SERVER_ARGS.split(' ')
        : ['-y', '@synkio/mcp-safety'],
    },
    paymentsServer: {
      url: process.env.MCP_PAYMENTS_SERVER_URL,
      command: process.env.MCP_PAYMENTS_SERVER_COMMAND || 'npx',
      args: process.env.MCP_PAYMENTS_SERVER_ARGS
        ? process.env.MCP_PAYMENTS_SERVER_ARGS.split(' ')
        : ['-y', '@synkio/mcp-payments'],
    },
  },
} as const;
