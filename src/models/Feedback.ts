import mongoose, { Schema, Document } from 'mongoose';
import { FeedbackChannel } from '../types';

export interface IFeedback extends Document {
  userEmail?: string;
  message: string;
  rating?: number;
  channel: FeedbackChannel;
  status: 'new' | 'reviewed' | 'resolved' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>({
  userEmail: {
    type: String,
    lowercase: true,
    trim: true,
    index: true
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  channel: {
    type: String,
    required: true,
    enum: Object.values(FeedbackChannel),
    default: FeedbackChannel.WEB,
    index: true
  },
  status: {
    type: String,
    enum: ['new', 'reviewed', 'resolved', 'archived'],
    default: 'new',
    index: true
  }
}, {
  timestamps: true
});

FeedbackSchema.index({ createdAt: -1 });
FeedbackSchema.index({ status: 1, createdAt: -1 });
FeedbackSchema.index({ channel: 1, createdAt: -1 });

export const Feedback = mongoose.model<IFeedback>('Feedback', FeedbackSchema);

