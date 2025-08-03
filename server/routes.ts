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
import { insertUserSchema, insertApiKeySchema } from "@shared/schema";
import { z } from "zod";
import { registerAdminRoutes } from "./routes/admin";

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

  // YouTube API routes
  app.get("/api/song/:videoId", authenticateApiKey, rateLimitByApiKey, async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { videoId } = req.params;
      const format = "mp3";
      
      // Check if already downloaded
      let download = await storage.getDownloadByYoutubeId(videoId, format);
      
      if (download && download.status === "completed") {
        // Return existing download
        await storage.updateApiKeyUsage(req.apiKey!.id);
        await storage.createUsageStats({
          userId: req.apiKey!.userId,
          apiKeyId: req.apiKey!.id,
          endpoint: "/song",
          responseTime: Date.now() - startTime,
          statusCode: 200
        });
        
        return res.json({
          status: "done",
          title: download.title,
          link: download.downloadUrl,
          format: download.format,
          duration: download.duration
        });
      }
      
      // Create new download record
      if (!download) {
        download = await storage.createDownload({
          youtubeId: videoId,
          format,
          userId: req.apiKey!.userId,
          apiKeyId: req.apiKey!.id
        });
      }
      
      // Get video info
      const videoInfo = await youtubeService.getVideoInfo(videoId);
      if (!videoInfo) {
        await storage.updateDownload(download.id, { status: "failed" });
        return res.status(404).json({ error: "Video not found" });
      }
      
      // Download and upload to Telegram
      const audioBuffer = await youtubeService.downloadAudio(videoId);
      if (!audioBuffer) {
        await storage.updateDownload(download.id, { status: "failed" });
        return res.status(500).json({ error: "Download failed" });
      }
      
      const telegramFile = await telegramService.uploadAudio(audioBuffer, videoInfo.title, videoId, videoInfo.duration);
      if (!telegramFile) {
        await storage.updateDownload(download.id, { status: "failed" });
        return res.status(500).json({ error: "Upload to Telegram failed" });
      }
      
      // Update download record
      const updatedDownload = await storage.updateDownload(download.id, {
        title: videoInfo.title,
        telegramMessageId: telegramFile.messageId,
        telegramFileId: telegramFile.fileId,
        downloadUrl: telegramFile.downloadUrl,
        duration: videoInfo.duration,
        fileSize: audioBuffer.length,
        status: "completed"
      });
      
      await storage.updateApiKeyUsage(req.apiKey!.id);
      await storage.createUsageStats({
        userId: req.apiKey!.userId,
        apiKeyId: req.apiKey!.id,
        endpoint: "/song",
        responseTime: Date.now() - startTime,
        statusCode: 200
      });
      
      res.json({
        status: "done",
        title: updatedDownload.title,
        link: updatedDownload.downloadUrl,
        format: updatedDownload.format,
        duration: updatedDownload.duration
      });
      
    } catch (error: any) {
      if (req.apiKey) {
        await storage.createUsageStats({
          userId: req.apiKey.userId,
          apiKeyId: req.apiKey.id,
          endpoint: "/song",
          responseTime: Date.now() - startTime,
          statusCode: 500
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/video/:videoId", authenticateApiKey, rateLimitByApiKey, async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { videoId } = req.params;
      const quality = req.query.quality as string || "720p";
      const format = "mp4";
      
      // Check if already downloaded
      let download = await storage.getDownloadByYoutubeId(videoId, format);
      
      if (download && download.status === "completed") {
        await storage.updateApiKeyUsage(req.apiKey!.id);
        await storage.createUsageStats({
          userId: req.apiKey!.userId,
          apiKeyId: req.apiKey!.id,
          endpoint: "/video",
          responseTime: Date.now() - startTime,
          statusCode: 200
        });
        
        return res.json({
          status: "done",
          title: download.title,
          link: download.downloadUrl,
          format: download.format,
          quality,
          duration: download.duration,
          size: download.fileSize ? `${(download.fileSize / 1024 / 1024).toFixed(1)} MB` : undefined
        });
      }
      
      // Create new download record
      if (!download) {
        download = await storage.createDownload({
          youtubeId: videoId,
          format,
          userId: req.apiKey!.userId,
          apiKeyId: req.apiKey!.id
        });
      }
      
      // Get video info
      const videoInfo = await youtubeService.getVideoInfo(videoId);
      if (!videoInfo) {
        await storage.updateDownload(download.id, { status: "failed" });
        return res.status(404).json({ error: "Video not found" });
      }
      
      // Download and upload to Telegram
      const videoBuffer = await youtubeService.downloadVideo(videoId, quality);
      if (!videoBuffer) {
        await storage.updateDownload(download.id, { status: "failed" });
        return res.status(500).json({ error: "Download failed" });
      }
      
      const telegramFile = await telegramService.uploadVideo(videoBuffer, videoInfo.title, videoId, videoInfo.duration);
      if (!telegramFile) {
        await storage.updateDownload(download.id, { status: "failed" });
        return res.status(500).json({ error: "Upload to Telegram failed" });
      }
      
      // Update download record
      const updatedDownload = await storage.updateDownload(download.id, {
        title: videoInfo.title,
        telegramMessageId: telegramFile.messageId,
        telegramFileId: telegramFile.fileId,
        downloadUrl: telegramFile.downloadUrl,
        duration: videoInfo.duration,
        fileSize: videoBuffer.length,
        status: "completed"
      });
      
      await storage.updateApiKeyUsage(req.apiKey!.id);
      await storage.createUsageStats({
        userId: req.apiKey!.userId,
        apiKeyId: req.apiKey!.id,
        endpoint: "/video",
        responseTime: Date.now() - startTime,
        statusCode: 200
      });
      
      res.json({
        status: "done",
        title: updatedDownload.title,
        link: updatedDownload.downloadUrl,
        format: updatedDownload.format,
        quality,
        duration: updatedDownload.duration,
        size: `${(updatedDownload.fileSize! / 1024 / 1024).toFixed(1)} MB`
      });
      
    } catch (error: any) {
      if (req.apiKey) {
        await storage.createUsageStats({
          userId: req.apiKey.userId,
          apiKeyId: req.apiKey.id,
          endpoint: "/video",
          responseTime: Date.now() - startTime,
          statusCode: 500
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/stats", authenticateUser, async (req, res) => {
    try {
      const userKeys = await storage.getUserApiKeys(req.user!.id);
      const downloads = await storage.getUserDownloads(req.user!.id);
      const usageStats = await storage.getUserUsageStats(req.user!.id);
      
      const totalRequests = usageStats.length;
      const successfulRequests = usageStats.filter(s => s.statusCode === 200).length;
      const successRate = totalRequests > 0 ? (successfulRequests / totalRequests * 100).toFixed(1) : "0";
      const avgResponseTime = totalRequests > 0 ? 
        Math.round(usageStats.reduce((sum, s) => sum + (s.responseTime || 0), 0) / totalRequests) : 0;
      
      const totalUsage = userKeys.reduce((sum, key) => sum + (key.usageCount || 0), 0);
      const totalLimit = userKeys.reduce((sum, key) => sum + (key.usageLimit || 0), 0);
      const creditsLeft = totalLimit - totalUsage;
      
      res.json({
        totalRequests,
        successRate: `${successRate}%`,
        avgResponseTime: `${avgResponseTime}ms`,
        creditsLeft,
        recentActivity: usageStats.slice(0, 10).map(stat => ({
          endpoint: stat.endpoint,
          statusCode: stat.statusCode,
          createdAt: stat.createdAt
        }))
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Demo payment route (Stripe temporarily disabled)
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { plan } = req.body;
      
      // Return demo client secret for now
      res.json({ 
        clientSecret: `demo_payment_intent_${plan}_${Date.now()}`,
        message: "Stripe not configured - demo mode" 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Search endpoint for Telegram channel content
  app.get("/api/search", authenticateApiKey, async (req, res) => {
    try {
      const { query, type } = req.query;
      
      if (!query) {
        return res.status(400).json({ error: "Search query required" });
      }

      // Search in database for uploaded content
      const downloads = await storage.searchDownloads(
        query as string, 
        type as 'audio' | 'video' | undefined
      );

      res.json({
        success: true,
        query: query,
        type: type || "all",
        results: downloads.map(download => ({
          videoId: download.youtubeId,
          title: download.title,
          format: download.format,
          duration: download.duration,
          streamUrl: download.downloadUrl,
          telegramUrl: `https://t.me/c/${process.env.TELEGRAM_CHANNEL_ID?.replace('-100', '')}/${download.telegramMessageId}`,
          metadata: {
            fileSize: download.fileSize,
            uploadedAt: download.createdAt,
            streamType: download.format === 'mp3' ? 'audio' : 'video'
          }
        }))
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get enhanced metadata for a specific video
  app.get("/api/metadata/:videoId", authenticateApiKey, async (req, res) => {
    try {
      const { videoId } = req.params;
      
      // Get all formats for this video
      const downloads = await storage.getDownloadsByYoutubeId(videoId);
      const videoInfo = await youtubeService.getVideoInfo(videoId);

      if (!videoInfo) {
        return res.status(404).json({ error: "Video not found" });
      }

      res.json({
        success: true,
        videoId,
        metadata: {
          title: videoInfo.title,
          duration: videoInfo.duration,
          thumbnail: videoInfo.thumbnail,
          availableFormats: downloads.map(d => ({
            format: d.format,
            status: d.status,
            streamUrl: d.downloadUrl,
            telegramUrl: d.telegramMessageId ? 
              `https://t.me/c/${process.env.TELEGRAM_CHANNEL_ID?.replace('-100', '')}/${d.telegramMessageId}` : null,
            fileSize: d.fileSize,
            uploadedAt: d.createdAt
          }))
        },
        telegram: {
          channelId: process.env.TELEGRAM_CHANNEL_ID,
          searchTags: [`#${videoId}`, "#TubeAPI", "#StreamReady"]
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint for Telegram connectivity
  app.get("/api/test/telegram", async (req, res) => {
    try {
      // Test with a small dummy file
      const testBuffer = Buffer.from("Test audio file for TubeAPI");
      const result = await telegramService.uploadAudio(testBuffer, "TubeAPI Test Audio", "test_video_id", "0:10");
      
      if (result) {
        res.json({
          success: true,
          message: "Telegram upload successful",
          fileInfo: result
        });
      } else {
        res.json({
          success: false,
          message: "Telegram upload failed"
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Telegram test failed", 
        error: error.message
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
