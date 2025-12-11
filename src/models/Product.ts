import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  productId: string;
  vendorEmail: string;
  name: string;
  description: string;
  category: string;
  price: {
    amount: string;
    currency: string;
    tokenAddress?: string;
  };
  images?: string[];
  stock?: {
    quantity: number;
    available: boolean;
  };
  status: 'draft' | 'active' | 'sold_out' | 'archived';
  metadata?: {
    specifications?: Record<string, any>;
    shipping?: any;
    tags?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>({
  productId: { type: String, required: true, unique: true, index: true },
  vendorEmail: { type: String, required: true, lowercase: true, index: true },
  name: { type: String, required: true, trim: true, text: true },
  description: { type: String, required: true, maxlength: 2000, text: true },
  category: { 
    type: String, 
    required: true, 
    enum: [
      'electronics', 'clothing', 'food', 'services', 'digital', 
      'art', 'collectibles', 'automotive', 'home', 'beauty', 'sports'
    ],
    index: true 
  },
  price: {
    amount: { type: String, required: true },
    currency: { type: String, required: true },
    tokenAddress: { type: String }
  },
  images: [String],
  stock: {
    quantity: { type: Number, default: 0 },
    available: { type: Boolean, default: true }
  },
  status: { 
    type: String, 
    enum: ['draft', 'active', 'sold_out', 'archived'], 
    default: 'draft', 
    index: true 
  },
  metadata: Schema.Types.Mixed
}, { timestamps: true });

ProductSchema.index({ vendorEmail: 1, status: 1 });
ProductSchema.index({ category: 1, status: 1 });
ProductSchema.index({ name: 'text', description: 'text' });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);

