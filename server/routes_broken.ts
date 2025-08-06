import type { Express } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Stripe from "stripe";
import { storage } from "./storage";
import { authenticateApiKey, authenticateUser } from "./middleware/auth";
import { rateLimitByApiKey, rateLimitByUser } from "./middleware/rateLimit";
import { youtubeService } from "./services/youtube";
import { telegramService } from "./services/telegram";
import { getTelegramSearchService } from "./services/telegramSearch";
import { insertUserSchema, insertApiKeySchema } from "@shared/schema";
import { z } from "zod";
import { registerAdminRoutes } from "./routes/admin";
import { fastCache } from "./cache";

// Temporarily disable Stripe requirement for demo
// if (!process.env.STRIPE_SECRET_KEY) {
//   throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
// }

// Set default JWT secret for demo
const JWT_SECRET = process.env.JWT_SECRET || 'demo-jwt-secret-key-for-development-only';

// Temporarily disable Stripe for demo
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
//   apiVersion: "2023-10-16",
// });

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Register admin routes
  registerAdminRoutes(app);
  
  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Create user
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });
      
      // Generate JWT
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
      
      res.json({ 
        user: { id: user.id, username: user.username, email: user.email, plan: user.plan, role: user.role },
        token 
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
      
      res.json({ 
        user: { id: user.id, username: user.username, email: user.email, plan: user.plan, role: user.role },
        token 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // API Key management routes
  app.get("/api/keys", authenticateUser, async (req, res) => {
    try {
      const keys = await storage.getUserApiKeys(req.user!.id);
      res.json(keys);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/keys", authenticateUser, async (req, res) => {
    try {
      const keyData = insertApiKeySchema.parse(req.body);
      const apiKey = await storage.createApiKey(req.user!.id, keyData);
      res.json(apiKey);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/keys/:id", authenticateUser, async (req, res) => {
    try {
      await storage.deactivateApiKey(req.params.id);
      res.json({ message: "API key deactivated" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // YouTube API routes - LIVE TELEGRAM CHANNEL SEARCH ONLY
  app.get("/api/song/:videoId", authenticateApiKey, rateLimitByApiKey, async (req, res) => {
    const startTime = Date.now();
    const requestId = `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🎵 [${requestId}] ===== AUDIO REQUEST STARTED (TELEGRAM-ONLY MODE) =====`);
    console.log(`🎵 [${requestId}] Video ID: ${req.params.videoId}`);
    console.log(`🎵 [${requestId}] API Key: ${req.apiKey?.key?.substring(0, 8)}...`);
    console.log(`🎵 [${requestId}] User ID: ${req.apiKey?.userId}`);
    console.log(`🎵 [${requestId}] Request Time: ${new Date().toISOString()}`);
    
    try {
      const { videoId } = req.params;
      const format = "mp3";
      
      // STEP 1: ONLY search live Telegram channel - NO DATABASE DEPENDENCY!
      console.log(`🔍 [${requestId}] Searching LIVE Telegram channel ONLY (database ignored)...`);
      
      try {
        const telegramSearchService = getTelegramSearchService();
        const telegramResult = await telegramSearchService.findExistingFile(videoId, format as 'mp3' | 'mp4');
        
        if (telegramResult && telegramResult.download_url) {
          const responseTime = Date.now() - startTime;
          console.log(`⚡ [${requestId}] TELEGRAM CHANNEL SUCCESS! Found in ${responseTime}ms`);
          console.log(`⚡ [${requestId}] Title: ${telegramResult.title}`);
          console.log(`🚀 [${requestId}] Direct Telegram URL: ${telegramResult.download_url}`);
          
          // Update usage stats in background only (non-blocking)
          setImmediate(() => {
            Promise.all([
              storage.updateApiKeyUsage(req.apiKey!.id),
              storage.createUsageStats({
                userId: req.apiKey!.userId,
                apiKeyId: req.apiKey!.id,
                endpoint: "/song",
                responseTime: responseTime,
                statusCode: 200
              })
            ]).catch(() => {}); // Silent error handling
          });
          
          return res.json({
            status: "done",
            title: telegramResult.title,
            link: telegramResult.download_url, // Direct from live Telegram channel!
            format: format,
            duration: telegramResult.duration?.toString() || "Unknown",
            source: "telegram_channel" // Indicate source
          });
        }
        
        console.log(`❌ [${requestId}] No file found in live Telegram channel`);
      } catch (error) {
        console.log(`⚠️ [${requestId}] Live Telegram search failed: ${error}`);
      }

      // If not found in Telegram, return not found (NO DATABASE FALLBACK)
      console.log(`❌ [${requestId}] Video not available in Telegram channel`);
      
      // Update usage stats for failed request
      setImmediate(() => {
        Promise.all([
          storage.updateApiKeyUsage(req.apiKey!.id),
          storage.createUsageStats({
            userId: req.apiKey!.userId,
            apiKeyId: req.apiKey!.id,
            endpoint: "/song",
            responseTime: Date.now() - startTime,
            statusCode: 404
          })
        ]).catch(() => {});
      });

      return res.status(404).json({
        status: "error",
        message: "Video not found in Telegram channel. Please try a different video ID.",
        videoId: videoId,
        format: format
      });

    } catch (error: any) {
      console.error(`❌ [${requestId}] API Error:`, error);
      const responseTime = Date.now() - startTime;
      
      // Update usage stats for error
      setImmediate(() => {
        Promise.all([
          storage.updateApiKeyUsage(req.apiKey!.id),
          storage.createUsageStats({
            userId: req.apiKey!.userId,
            apiKeyId: req.apiKey!.id,
            endpoint: "/song",
            responseTime: responseTime,
            statusCode: 500,
            errorMessage: error.message
          })
        ]).catch(() => {});
      });

      res.status(500).json({
        status: "error",
        message: "Internal server error while searching Telegram channel",
        error: error.message
      });
    }
  });
        downloadUrl: directDownloadUrl,
        duration: videoInfo.duration,
        status: "completed"
