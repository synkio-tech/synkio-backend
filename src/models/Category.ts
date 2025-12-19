import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  icon: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  order: {
    type: Number,
    default: 0,
    index: true
  }
}, {
  timestamps: true
});

CategorySchema.index({ isActive: 1, order: 1 });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
