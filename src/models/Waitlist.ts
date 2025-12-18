import mongoose, { Schema, Document } from 'mongoose';

export interface IWaitlist extends Document {
  email: string;
  name?: string;
  joinedAt: Date;
  notified: boolean;
  notifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WaitlistSchema = new Schema<IWaitlist>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
  joinedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  notified: {
    type: Boolean,
    default: false
  },
  notifiedAt: {
    type: Date
  }
}, {
  timestamps: true
});

WaitlistSchema.index({ joinedAt: -1 });
WaitlistSchema.index({ notified: 1 });

export const Waitlist = mongoose.model<IWaitlist>('Waitlist', WaitlistSchema);
