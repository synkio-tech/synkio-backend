import mongoose, { Schema, Document } from 'mongoose';

export interface IConversation extends Document {
  conversationId: string;
  userEmail: string;
  channel: 'web' | 'whatsapp' | 'farcaster';
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    toolCalls?: Array<{
      name: string;
      arguments: any;
      result?: any;
    }>;
  }>;
  context?: {
    currentIntent?: string;
    activeTransaction?: string;
    activeEscrowId?: number;
    lastProductSearched?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>({
  conversationId: { type: String, required: true, unique: true, index: true },
  userEmail: { type: String, required: true, lowercase: true, index: true },
  channel: { 
    type: String, 
    required: true, 
    enum: ['web', 'whatsapp', 'farcaster'],
    index: true 
  },
  messages: [{
    role: { 
      type: String, 
      required: true, 
      enum: ['user', 'assistant', 'system'] 
    },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    toolCalls: [{
      name: String,
      arguments: Schema.Types.Mixed,
      result: Schema.Types.Mixed
    }]
  }],
  context: Schema.Types.Mixed
}, { timestamps: true });

ConversationSchema.index({ userEmail: 1, channel: 1 });
ConversationSchema.index({ conversationId: 1, updatedAt: -1 });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);

