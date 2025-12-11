import mongoose, { Schema, Document } from 'mongoose';
import { KYCStatus, PrivacyLevel } from '../types';

export interface IUser extends Document {
  email: string;
  username: string;
  password: string;
  walletAddress: string;
  encryptedPrivateKey: string;
  phoneNumber?: string; // whatsapp phone number
  consentGiven: boolean;
  onboardingCompleted: boolean;
  profile: {
    name: string;
    bio?: string;
    isVendor: boolean;
    categories?: string[];
    avatar?: string;
    location?: string;
    website?: string;
  };
  reputation: {
    score: number;
    totalTransactions: number;
    completedTransactions: number;
    disputes: number;
    totalVolume: number;
    lastUpdated: Date;
  };
  preferences: {
    notifications: boolean;
    emailUpdates: boolean;
    privacyLevel: PrivacyLevel;
  };
  verification: {
    emailVerified: boolean;
    phoneVerified: boolean;
    kycStatus: KYCStatus;
    kycCompleted: boolean;
    documentsUploaded: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9_.-]+$/, 'Username can only contain lowercase letters, numbers, dots, underscores, and hyphens']
  },
  password: {
    type: String,
    required: true
  },
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  encryptedPrivateKey: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    sparse: true,
    index: true
  },
  consentGiven: {
    type: Boolean,
    default: false
  },
  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  profile: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    bio: {
      type: String,
      maxlength: 500
    },
    isVendor: {
      type: Boolean,
      default: false
    },
    categories: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    avatar: String,
    location: String,
    website: String
  },
  reputation: {
    score: {
      type: Number,
      default: 500,
      min: 0,
      max: 1000
    },
    totalTransactions: {
      type: Number,
      default: 0
    },
    completedTransactions: {
      type: Number,
      default: 0
    },
    disputes: {
      type: Number,
      default: 0
    },
    totalVolume: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  preferences: {
    notifications: {
      type: Boolean,
      default: true
    },
    emailUpdates: {
      type: Boolean,
      default: true
    },
    privacyLevel: {
      type: String,
      enum: Object.values(PrivacyLevel),
      default: PrivacyLevel.PUBLIC
    }
  },
  verification: {
    emailVerified: {
      type: Boolean,
      default: false
    },
    phoneVerified: {
      type: Boolean,
      default: false
    },
    kycStatus: {
      type: String,
      enum: Object.values(KYCStatus),
      default: KYCStatus.NOT_STARTED,
      index: true
    },
    kycCompleted: {
      type: Boolean,
      default: false
    },
    documentsUploaded: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
UserSchema.index({ 'profile.isVendor': 1, 'reputation.score': -1 });
UserSchema.index({ 'profile.categories': 1 });
UserSchema.index({ 'reputation.totalVolume': -1 });
UserSchema.index({ createdAt: -1 });

export const User = mongoose.model<IUser>('User', UserSchema);
