import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User';
import { WalletService } from '../src/services/WalletService';

dotenv.config();

const walletService = new WalletService();

const sampleVendors = [
  {
    email: 'techgear@example.com',
    profile: {
      name: 'TechGear Store',
      bio: 'Premium electronics and gadgets for tech enthusiasts',
      isVendor: true,
      categories: ['electronics'],
      location: 'Lagos, Nigeria',
      website: 'https://techgear.ng'
    }
  },
  {
    email: 'fashionforward@example.com',
    profile: {
      name: 'Fashion Forward',
      bio: 'Trendy fashion items and accessories',
      isVendor: true,
      categories: ['clothing'],
      location: 'Abuja, Nigeria',
      website: 'https://fashionforward.ng'
    }
  },
  {
    email: 'homeessentials@example.com',
    profile: {
      name: 'Home Essentials',
      bio: 'Quality home and garden products',
      isVendor: true,
      categories: ['home'],
      location: 'Port Harcourt, Nigeria',
      website: 'https://homeessentials.ng'
    }
  },
  {
    email: 'cryptocollectibles@example.com',
    profile: {
      name: 'Crypto Collectibles',
      bio: 'Unique NFT collections and digital art',
      isVendor: true,
      categories: ['digital', 'art'],
      location: 'Global',
      website: 'https://cryptocollectibles.io'
    }
  },
  {
    email: 'fooddelivery@example.com',
    profile: {
      name: 'Food Delivery Pro',
      bio: 'Fresh meals delivered to your doorstep',
      isVendor: true,
      categories: ['food', 'services'],
      location: 'Lagos, Nigeria',
      website: 'https://fooddeliverypro.ng'
    }
  },
  {
    email: 'beautysupplies@example.com',
    profile: {
      name: 'Beauty Supplies Co',
      bio: 'Professional beauty and skincare products',
      isVendor: true,
      categories: ['beauty'],
      location: 'Abuja, Nigeria',
      website: 'https://beautysupplies.ng'
    }
  },
  {
    email: 'sportsequipment@example.com',
    profile: {
      name: 'Sports Equipment Hub',
      bio: 'Quality sports gear and fitness equipment',
      isVendor: true,
      categories: ['sports'],
      location: 'Lagos, Nigeria',
      website: 'https://sportsequipment.ng'
    }
  },
  {
    email: 'automotiveparts@example.com',
    profile: {
      name: 'Automotive Parts Plus',
      bio: 'Genuine automotive parts and accessories',
      isVendor: true,
      categories: ['automotive'],
      location: 'Port Harcourt, Nigeria',
      website: 'https://automotiveparts.ng'
    }
  }
];

async function seedVendors() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/synkio');
    console.log('Connected to MongoDB');

    // Clear existing vendors
    await User.deleteMany({ 'profile.isVendor': true });
    console.log('Cleared existing vendors');

    // Create vendors with wallets
    for (const vendorData of sampleVendors) {
      try {
        // Hash password
        const password = 'password123';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create wallet
        const { address: walletAddress, encryptedPrivateKey } = await walletService.createWallet(hashedPassword);

        const vendor = new User({
          email: vendorData.email,
          username: `${vendorData.email.split('@')[0]}.synkio`,
          password: hashedPassword,
          walletAddress,
          encryptedPrivateKey,
          consentGiven: true,
          onboardingCompleted: true,
          profile: vendorData.profile,
          reputation: {
            score: Math.floor(Math.random() * 200) + 400, // Random score between 400-600
            totalTransactions: Math.floor(Math.random() * 50),
            completedTransactions: Math.floor(Math.random() * 45),
            disputes: Math.floor(Math.random() * 3),
            totalVolume: Math.floor(Math.random() * 10000),
            lastUpdated: new Date()
          }
        });

        await vendor.save();
        console.log(`Created vendor: ${vendorData.profile.name} (${vendorData.email})`);
      } catch (error) {
        console.error(`Error creating vendor ${vendorData.email}:`, error);
      }
    }

    console.log('Vendor seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding vendors:', error);
    process.exit(1);
  }
}

// Run the seed function
seedVendors();
