import { Request, Response } from 'express';
import { Product } from '../models/Product';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware';
import { ApiResponse } from '../types';
import { sanitizeString, sanitizeEmail, sanitizeUrl, containsScriptTags } from '../utils/sanitize';
import { randomUUID } from 'crypto';

export class ProductController {
  static createProduct = asyncHandler(async (req: Request, res: Response) => {
    const { vendorEmail, name, description, category, price, images, stock, metadata } = req.body;
    
    const sanitizedEmail = sanitizeEmail(vendorEmail);
    
    if (containsScriptTags(name) || containsScriptTags(description) || 
        (metadata?.specifications && containsScriptTags(JSON.stringify(metadata.specifications)))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid characters detected in input'
      });
    }
    
    const productId = randomUUID();
    const sanitizedName = sanitizeString(name);
    const sanitizedDescription = sanitizeString(description);
    const sanitizedImages = images?.map((img: string) => sanitizeUrl(img)) || [];
    
    const product = new Product({
      productId,
      vendorEmail: sanitizedEmail,
      name: sanitizedName,
      description: sanitizedDescription,
      category,
      price: {
        amount: price.amount,
        currency: price.currency,
        tokenAddress: price.tokenAddress
      },
      images: sanitizedImages,
      stock: stock || { quantity: 0, available: true },
      status: 'draft',
      metadata: metadata || {}
    });

    await product.save();
    
    const response: ApiResponse = {
      success: true,
      message: 'Product created successfully',
      data: product
    };
    
    res.status(201).json(response);
  });

  static getProducts = asyncHandler(async (req: Request, res: Response) => {
    const { category, status, search, page = 1, limit = 20 } = req.query;
    
    const query: any = {};
    
    if (category) {
      query.category = category;
    }
    
    if (status) {
      query.status = status;
    } else {
      query.status = 'active';
    }
    
    if (search) {
      query.$text = { $search: search as string };
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const products = await Product.find(query)
      .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    const total = await Product.countDocuments(query);

    const response: ApiResponse = {
      success: true,
      data: {
        products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    };

    res.status(200).json(response);
  });

  static getProduct = asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.params;
    const product = await Product.findOne({ productId });
    
    if (!product) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found' 
      });
    }

    const response: ApiResponse = {
      success: true,
      data: product
    };

    res.status(200).json(response);
  });

  static updateProduct = asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.params;
    const { vendorEmail, name, description, category, price, images, stock, status, metadata } = req.body;
    
    const product = await Product.findOne({ productId });
    
    if (!product) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found' 
      });
    }
    
    const sanitizedVendorEmail = sanitizeEmail(vendorEmail);
    if (product.vendorEmail !== sanitizedVendorEmail) {
      return res.status(403).json({ 
        success: false,
        error: 'Not authorized to update this product' 
      });
    }
    
    if (name && containsScriptTags(name)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid characters detected in name'
      });
    }
    
    if (description && containsScriptTags(description)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid characters detected in description'
      });
    }
    
    const updateData: any = {};
    if (name) updateData.name = sanitizeString(name);
    if (description) updateData.description = sanitizeString(description);
    if (category) updateData.category = category;
    if (price) updateData.price = price;
    if (images) updateData.images = images.map((img: string) => sanitizeUrl(img));
    if (stock) updateData.stock = stock;
    if (status) updateData.status = status;
    if (metadata) updateData.metadata = metadata;
    
    const updatedProduct = await Product.findOneAndUpdate(
      { productId },
      updateData,
      { new: true }
    );

    const response: ApiResponse = {
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    };

    res.status(200).json(response);
  });

  static deleteProduct = asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.params;
    const { vendorEmail } = req.body;
    
    const product = await Product.findOne({ productId });
    
    if (!product) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found' 
      });
    }
    
    const sanitizedVendorEmail = sanitizeEmail(vendorEmail);
    if (product.vendorEmail !== sanitizedVendorEmail) {
      return res.status(403).json({ 
        success: false,
        error: 'Not authorized to delete this product' 
      });
    }
    
    await Product.findOneAndDelete({ productId });

    const response: ApiResponse = {
      success: true,
      message: 'Product deleted successfully'
    };

    res.status(200).json(response);
  });

  static getVendorProducts = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.params;
    const { status, page = 1, limit = 20 } = req.query;
    const sanitizedEmail = sanitizeEmail(email);
    
    const query: any = { vendorEmail: sanitizedEmail };
    
    if (status) {
      query.status = status;
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    const total = await Product.countDocuments(query);

    const response: ApiResponse = {
      success: true,
      data: {
        products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    };

    res.status(200).json(response);
  });
}

