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

// Set default JWT secret for demo
const JWT_SECRET = process.env.JWT_SECRET || 'demo-jwt-secret-key-for-development-only';

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

  // TELEGRAM-ONLY YOUTUBE API ROUTES (NO DATABASE DEPENDENCY FOR CONTENT)
  app.get("/api/song/:videoId", authenticateApiKey, rateLimitByApiKey, async (req, res) => {
    const startTime = Date.now();
    const requestId = `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🎵 [${requestId}] ===== TELEGRAM-ONLY AUDIO REQUEST =====`);
    console.log(`🎵 [${requestId}] Video ID: ${req.params.videoId}`);
    console.log(`🎵 [${requestId}] API Key: ${req.apiKey?.key?.substring(0, 8)}...`);
    console.log(`🎵 [${requestId}] Request Time: ${new Date().toISOString()}`);
    
    try {
      const { videoId } = req.params;
      const format = "mp3";
      
      // ONLY search live Telegram channel - NO DATABASE CONTENT DEPENDENCY!
      console.log(`🔍 [${requestId}] Searching LIVE Telegram channel ONLY...`);
      
      const telegramSearchService = getTelegramSearchService();
      const telegramResult = await telegramSearchService.findExistingFile(videoId, format as 'mp3' | 'mp4');
      
      if (telegramResult && telegramResult.download_url) {
        const responseTime = Date.now() - startTime;
        console.log(`⚡ [${requestId}] TELEGRAM SUCCESS! Found in ${responseTime}ms`);
        console.log(`⚡ [${requestId}] Title: ${telegramResult.title}`);
        console.log(`🚀 [${requestId}] Direct URL: ${telegramResult.download_url}`);
        
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
      
      console.log(`❌ [${requestId}] Video not found in Telegram channel`);
      
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

  // TELEGRAM-ONLY VIDEO ROUTE
  app.get("/api/video/:videoId", authenticateApiKey, rateLimitByApiKey, async (req, res) => {
    const startTime = Date.now();
    const requestId = `VID_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🎬 [${requestId}] ===== TELEGRAM-ONLY VIDEO REQUEST =====`);
    console.log(`🎬 [${requestId}] Video ID: ${req.params.videoId}`);
    console.log(`🎬 [${requestId}] API Key: ${req.apiKey?.key?.substring(0, 8)}...`);
    
    try {
      const { videoId } = req.params;
      const format = "mp4";
      
      // ONLY search live Telegram channel - NO DATABASE CONTENT DEPENDENCY!
      console.log(`🔍 [${requestId}] Searching LIVE Telegram channel ONLY...`);
      
      const telegramSearchService = getTelegramSearchService();
      const telegramResult = await telegramSearchService.findExistingFile(videoId, format as 'mp3' | 'mp4');
      
      if (telegramResult && telegramResult.download_url) {
        const responseTime = Date.now() - startTime;
        console.log(`⚡ [${requestId}] TELEGRAM SUCCESS! Found in ${responseTime}ms`);
        console.log(`⚡ [${requestId}] Title: ${telegramResult.title}`);
        console.log(`🚀 [${requestId}] Direct URL: ${telegramResult.download_url}`);
        
        // Update usage stats in background only (non-blocking)
        setImmediate(() => {
          Promise.all([
            storage.updateApiKeyUsage(req.apiKey!.id),
            storage.createUsageStats({
              userId: req.apiKey!.userId,
              apiKeyId: req.apiKey!.id,
              endpoint: "/video",
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
      
      console.log(`❌ [${requestId}] Video not found in Telegram channel`);
      
      // Update usage stats for failed request
      setImmediate(() => {
        Promise.all([
          storage.updateApiKeyUsage(req.apiKey!.id),
          storage.createUsageStats({
            userId: req.apiKey!.userId,
            apiKeyId: req.apiKey!.id,
            endpoint: "/video",
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
            endpoint: "/video",
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

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "OK", 
      timestamp: new Date().toISOString(),
      mode: "telegram_only" 
    });
  });

  // Test Telegram search directly (no auth required)
  app.get("/api/test-telegram/:videoId", async (req, res) => {
    const startTime = Date.now();
    const { videoId } = req.params;
    const format = req.query.format as string || "mp3";
    
    console.log(`🔍 Testing Telegram search for: ${videoId}.${format}`);
    
    try {
      const telegramSearchService = getTelegramSearchService();
      const result = await telegramSearchService.findExistingFile(videoId, format as 'mp3' | 'mp4');
      
      const responseTime = Date.now() - startTime;
      
      if (result && result.download_url) {
        console.log(`✅ Found in Telegram channel: ${result.title}`);
        res.json({
          success: true,
          found: true,
          title: result.title,
          download_url: result.download_url,
          file_id: result.file_id,
          duration: result.duration,
          file_size: result.file_size,
          message_id: result.message_id,
          response_time: responseTime
        });
      } else {
        console.log(`❌ Not found in Telegram channel`);
        res.json({
          success: true,
          found: false,
          message: "Video not found in Telegram channel",
          response_time: responseTime
        });
      }
    } catch (error: any) {
      console.error(`❌ Telegram search error:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        response_time: Date.now() - startTime
      });
    }
  });

  // Check what's available in Telegram channel
  app.get("/api/test-channel-content", async (req, res) => {
    const startTime = Date.now();
    
    console.log(`📋 Checking channel content...`);
    
    try {
      const botToken = '7322756571:AAFe906CdE-qEgqlf1d956KmYOwFN_M4Avo';
      const url = `https://api.telegram.org/bot${botToken}/getUpdates`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: 100,
          allowed_updates: ['channel_post'],
          timeout: 10
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      if (!data.ok) {
        throw new Error(`Telegram error: ${data.description}`);
      }

      console.log(`📨 Total updates received: ${data.result.length}`);
      
      // Process channel posts
      const channelPosts = data.result
        .filter((update: any) => update.channel_post)
        .map((update: any) => {
          const post = update.channel_post;
          const text = post.text || post.caption || '';
          
          console.log(`📝 Message ${post.message_id}: ${text.substring(0, 100)}...`);
          
          return {
            message_id: post.message_id,
            text: text.substring(0, 200),
            has_audio: !!post.audio,
            has_video: !!post.video,
            has_document: !!post.document,
            file_type: post.audio ? 'audio' : post.video ? 'video' : post.document ? 'document' : 'text'
          };
        });
      
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        total_updates: data.result.length,
        channel_posts: channelPosts.length,
        posts: channelPosts,
        response_time: responseTime
      });
      
    } catch (error: any) {
      console.error(`❌ Channel content check error:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        response_time: Date.now() - startTime
      });
    }
  });

  // Create HTTP server
  const server = createServer(app);
  
  return server;
}