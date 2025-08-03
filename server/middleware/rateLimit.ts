import { Request, Response, NextFunction } from "express";

const apiKeyLimits = new Map<string, { count: number; resetTime: number }>();
const userLimits = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const API_KEY_LIMIT = 10; // 10 requests per minute per API key
const USER_LIMIT = 5; // 5 requests per minute per user

export function rateLimitByApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.apiKey?.key;
  
  if (!apiKey) {
    return next();
  }
  
  const now = Date.now();
  const limit = apiKeyLimits.get(apiKey);
  
  if (!limit || now > limit.resetTime) {
    // Reset or create new limit
    apiKeyLimits.set(apiKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  if (limit.count >= API_KEY_LIMIT) {
    return res.status(429).json({ 
      error: "Rate limit exceeded",
      resetTime: new Date(limit.resetTime).toISOString()
    });
  }
  
  limit.count++;
  next();
}

export function rateLimitByUser(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  
  if (!userId) {
    return next();
  }
  
  const now = Date.now();
  const limit = userLimits.get(userId);
  
  if (!limit || now > limit.resetTime) {
    // Reset or create new limit
    userLimits.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  if (limit.count >= USER_LIMIT) {
    return res.status(429).json({ 
      error: "Rate limit exceeded",
      resetTime: new Date(limit.resetTime).toISOString()
    });
  }
  
  limit.count++;
  next();
}
