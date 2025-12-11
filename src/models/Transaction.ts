import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  transactionId: string;
  escrowId: string;
  buyerEmail: string;
  sellerEmail: string;
  amount: number;
  currency: string;
  status: 'pending' | 'funded' | 'completed' | 'disputed' | 'cancelled' | 'expired';
  type: 'marketplace' | 'service';
  metadata: {
    title: string;
    description: string;
    category?: string;
    milestones?: Array<{
      amount: number;
      description: string;
      completed: boolean;
      completedAt?: Date;
    }>;
    images?: string[];
    tags?: string[];
  };
  conversationContext: {
    channel: 'whatsapp' | 'farcaster' | 'web';
    messageHistory: Array<{
      timestamp: Date;
      sender: string;
      message: string;
      type: 'text' | 'image' | 'file';
    }>;
    conversationId?: string;
  };
  timeline: Array<{
    status: string;
    timestamp: Date;
    description: string;
    actor?: string;
  }>;
  dispute?: {
    reason: string;
    evidence: string[];
    arbitrator?: string;
    resolution?: string;
    createdAt: Date;
    resolvedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  escrowId: {
    type: String,
    required: true,
    index: true
  },
  buyerEmail: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  sellerEmail: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'ETH',
    enum: ['ETH', 'USDC', 'USDT', 'DAI']
  },
  status: {
    type: String,
    enum: ['pending', 'funded', 'completed', 'disputed', 'cancelled', 'expired'],
    default: 'pending',
    index: true
  },
  type: {
    type: String,
    enum: ['marketplace', 'service'],
    required: true
  },
  metadata: {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      maxlength: 2000
    },
    category: {
      type: String,
      enum: [
        'electronics', 'clothing', 'food', 'services', 'digital', 
        'art', 'collectibles', 'automotive', 'home', 'beauty', 'sports'
      ]
    },
    milestones: [{
      amount: Number,
      description: String,
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: Date
    }],
    images: [String],
    tags: [String]
  },
  conversationContext: {
    channel: {
      type: String,
      enum: ['whatsapp', 'farcaster', 'web'],
      required: true
    },
    messageHistory: [{
      timestamp: {
        type: Date,
        default: Date.now
      },
      sender: String,
      message: String,
      type: {
        type: String,
        enum: ['text', 'image', 'file'],
        default: 'text'
      }
    }],
    conversationId: String
  },
  timeline: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    description: String,
    actor: String
  }],
  dispute: {
    reason: String,
    evidence: [String],
    arbitrator: String,
    resolution: String,
    createdAt: Date,
    resolvedAt: Date
  }
}, {
  timestamps: true
});

// Indexes for better query performance
TransactionSchema.index({ buyerEmail: 1, createdAt: -1 });
TransactionSchema.index({ sellerEmail: 1, createdAt: -1 });
TransactionSchema.index({ status: 1, createdAt: -1 });
TransactionSchema.index({ 'metadata.category': 1 });
TransactionSchema.index({ 'conversationContext.channel': 1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
