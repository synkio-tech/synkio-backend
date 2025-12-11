import { Request, Response } from 'express';
import { Category } from '../models/Category';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware';
import { ApiResponse } from '../types';
import { sanitizeString, containsScriptTags } from '../utils/sanitize';

export class CategoryController {
  static getCategories = asyncHandler(async (req: Request, res: Response) => {
    const { isActive } = req.query;
    
    const query: any = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const categories = await Category.find(query)
      .sort({ order: 1, name: 1 })
      .select('name slug description icon isActive order');
    
    const response: ApiResponse = {
      success: true,
      data: {
        categories: categories.map(cat => ({
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          icon: cat.icon,
          isActive: cat.isActive,
          order: cat.order
        }))
      }
    };
    
    res.status(200).json(response);
  });

  static getCategory = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params;
    
    const category = await Category.findOne({ slug: slug.toLowerCase() });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }
    
    const response: ApiResponse = {
      success: true,
      data: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        icon: category.icon,
        isActive: category.isActive,
        order: category.order
      }
    };
    
    res.status(200).json(response);
  });

  static createCategory = asyncHandler(async (req: Request, res: Response) => {
    const { name, description, icon, order } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Category name is required'
      });
    }
    
    if (containsScriptTags(name) || (description && containsScriptTags(description))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid characters detected in input'
      });
    }
    
    const sanitizedName = sanitizeString(name).trim();
    const slug = sanitizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    if (slug.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category name'
      });
    }
    
    const existingCategory = await Category.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${sanitizedName}$`, 'i') } },
        { slug: slug }
      ]
    });
    
    if (existingCategory) {
      return res.status(409).json({
        success: false,
        error: 'Category already exists'
      });
    }
    
    const maxOrder = await Category.findOne().sort({ order: -1 }).select('order');
    const categoryOrder = order !== undefined ? Number(order) : (maxOrder?.order || 0) + 1;
    
    const category = new Category({
      name: sanitizedName,
      slug,
      description: description ? sanitizeString(description) : undefined,
      icon: icon ? sanitizeString(icon) : undefined,
      order: categoryOrder,
      isActive: true
    });
    
    await category.save();
    
    const response: ApiResponse = {
      success: true,
      message: 'Category created successfully',
      data: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        icon: category.icon,
        isActive: category.isActive,
        order: category.order
      }
    };
    
    res.status(201).json(response);
  });

  static updateCategory = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params;
    const { name, description, icon, isActive, order } = req.body;
    
    const category = await Category.findOne({ slug: slug.toLowerCase() });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
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
    
    if (name) {
      const sanitizedName = sanitizeString(name).trim();
      const newSlug = sanitizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      if (newSlug.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category name'
        });
      }
      
      const existingCategory = await Category.findOne({
        $or: [
          { name: { $regex: new RegExp(`^${sanitizedName}$`, 'i') } },
          { slug: newSlug }
        ],
        _id: { $ne: category._id }
      });
      
      if (existingCategory) {
        return res.status(409).json({
          success: false,
          error: 'Category name already exists'
        });
      }
      
      updateData.name = sanitizedName;
      updateData.slug = newSlug;
    }
    
    if (description !== undefined) {
      updateData.description = description ? sanitizeString(description) : undefined;
    }
    
    if (icon !== undefined) {
      updateData.icon = icon ? sanitizeString(icon) : undefined;
    }
    
    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }
    
    if (order !== undefined) {
      updateData.order = Number(order);
    }
    
    const updatedCategory = await Category.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      updateData,
      { new: true }
    );
    
    const response: ApiResponse = {
      success: true,
      message: 'Category updated successfully',
      data: {
        name: updatedCategory!.name,
        slug: updatedCategory!.slug,
        description: updatedCategory!.description,
        icon: updatedCategory!.icon,
        isActive: updatedCategory!.isActive,
        order: updatedCategory!.order
      }
    };
    
    res.status(200).json(response);
  });

  static deleteCategory = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params;
    
    const category = await Category.findOne({ slug: slug.toLowerCase() });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }
    
    await Category.findOneAndDelete({ slug: slug.toLowerCase() });
    
    const response: ApiResponse = {
      success: true,
      message: 'Category deleted successfully'
    };
    
    res.status(200).json(response);
  });
}
