import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { User, ApiKey } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      apiKey?: ApiKey;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'demo-jwt-secret-key-for-development-only';

export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await storage.getUser(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
}

export async function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    // Support both header and query parameter for API key
    const apiKey = (req.headers['x-api-key'] as string) || 
                   (req.headers['X-API-Key'] as string) || 
                   (req.query.api as string);
    
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }
    
    const key = await storage.getApiKey(apiKey);
    
    if (!key) {
      return res.status(401).json({ error: "Invalid API key" });
    }
    
    if (!key.isActive) {
      return res.status(401).json({ error: "API key is deactivated" });
    }
    
    // Check if API key has expired
    if (key.expiresAt && new Date() > new Date(key.expiresAt)) {
      return res.status(401).json({ error: "API key has expired" });
    }
    
    // Check monthly usage limit
    if ((key.usageCount || 0) >= (key.usageLimit || 0)) {
      return res.status(429).json({ error: "Monthly API key usage limit exceeded" });
    }
    
    // Check if daily limit needs reset
    const now = new Date();
    const lastReset = key.lastResetDate ? new Date(key.lastResetDate) : new Date();
    const shouldReset = now.getDate() !== lastReset.getDate() || 
                       now.getMonth() !== lastReset.getMonth() || 
                       now.getFullYear() !== lastReset.getFullYear();
    
    if (shouldReset) {
      // Reset daily usage
      await storage.resetDailyUsage(key.id);
      key.dailyUsage = 0;
      key.lastResetDate = now;
    }
    
    // Check daily usage limit
    if ((key.dailyUsage || 0) >= (key.dailyLimit || 100)) {
      return res.status(429).json({ error: "Daily API key usage limit exceeded" });
    }
    
    req.apiKey = key;
    next();
  } catch (error) {
    res.status(500).json({ error: "Authentication failed" });
  }
}
