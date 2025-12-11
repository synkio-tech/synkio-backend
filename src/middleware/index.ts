import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(`Error: ${error.message}`, {
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const validateRequest = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      
      req.body = validated.body;
      req.query = validated.query;
      req.params = validated.params;
      
      next();
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }
  };
};

export const validateDto = (dtoClass: any, source: 'body' | 'query' | 'params' = 'body') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      const dto = plainToInstance(dtoClass, data);
      
      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: false
      });
      
      if (errors.length > 0) {
        const formattedErrors = errors.map((error: ValidationError) => ({
          property: error.property,
          constraints: error.constraints,
          value: error.value
        }));
        
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: formattedErrors.map(err => ({
            path: err.property,
            message: Object.values(err.constraints || {})[0] || 'Invalid value'
          }))
        });
      }
      
      if (source === 'body') {
        req.body = dto;
      } else if (source === 'query') {
        req.query = dto as any;
      } else {
        req.params = dto as any;
      }
      
      next();
    } catch (error: any) {
      logger.error('Validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Validation error',
        details: error.message
      });
    }
  };
};
