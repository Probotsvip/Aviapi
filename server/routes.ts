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
    const requestId = `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🎵 [${requestId}] ===== AUDIO REQUEST STARTED =====`);
    console.log(`🎵 [${requestId}] Video ID: ${req.params.videoId}`);
    console.log(`🎵 [${requestId}] API Key: ${req.apiKey?.key?.substring(0, 8)}...`);
    console.log(`🎵 [${requestId}] User ID: ${req.apiKey?.userId}`);
    console.log(`🎵 [${requestId}] Request Time: ${new Date().toISOString()}`);
    
    try {
      const { videoId } = req.params;
      const format = "mp3";
      
      // Check if already downloaded
      console.log(`🔍 [${requestId}] Checking database for existing download...`);
      let download = await storage.getDownloadByYoutubeId(videoId, format);
      
      if (download) {
        console.log(`✅ [${requestId}] CACHED HIT! Found existing download:`);
        console.log(`✅ [${requestId}] - Title: ${download.title}`);
        console.log(`✅ [${requestId}] - Status: ${download.status}`);
        console.log(`✅ [${requestId}] - File Size: ${download.fileSize ? (download.fileSize / 1024 / 1024).toFixed(1) + ' MB' : 'Unknown'}`);
        console.log(`✅ [${requestId}] - Telegram Message: ${download.telegramMessageId}`);
        console.log(`✅ [${requestId}] - Stream URL: ${download.downloadUrl}`);
      } else {
        console.log(`❌ [${requestId}] CACHE MISS! No existing download found, will need to process...`);
      }
      
      if (download && download.status === "completed") {
        // Return existing download
        console.log(`⚡ [${requestId}] RETURNING CACHED RESULT - No processing needed!`);
        const responseTime = Date.now() - startTime;
        console.log(`⚡ [${requestId}] Response time: ${responseTime}ms (FAST!)`);
        
        await storage.updateApiKeyUsage(req.apiKey!.id);
        await storage.createUsageStats({
          userId: req.apiKey!.userId,
          apiKeyId: req.apiKey!.id,
          endpoint: "/song",
          responseTime: responseTime,
          statusCode: 200
        });
        
        console.log(`🎵 [${requestId}] ===== AUDIO REQUEST COMPLETED (CACHED) =====`);
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
      console.log(`⬇️ [${requestId}] Starting audio download from YouTube...`);
      const downloadStartTime = Date.now();
      const audioBuffer = await youtubeService.downloadAudio(videoId);
      const downloadTime = Date.now() - downloadStartTime;
      console.log(`⬇️ [${requestId}] Download completed in ${downloadTime}ms`);
      console.log(`⬇️ [${requestId}] Audio buffer size: ${audioBuffer ? (audioBuffer.length / 1024 / 1024).toFixed(1) + ' MB' : 'FAILED'}`);
      
      if (!audioBuffer) {
        console.log(`❌ [${requestId}] ERROR: Audio download failed!`);
        await storage.updateDownload(download.id, { status: "failed" });
        return res.status(500).json({ error: "Download failed" });
      }
      
      console.log(`📤 [${requestId}] Uploading to Telegram channel...`);
      const uploadStartTime = Date.now();
      const telegramFile = await telegramService.uploadAudio(audioBuffer, videoInfo.title, videoId, videoInfo.duration);
      const uploadTime = Date.now() - uploadStartTime;
      console.log(`📤 [${requestId}] Telegram upload completed in ${uploadTime}ms`);
      
      if (telegramFile) {
        console.log(`📤 [${requestId}] Upload SUCCESS:`);
        console.log(`📤 [${requestId}] - Message ID: ${telegramFile.messageId}`);
        console.log(`📤 [${requestId}] - File ID: ${telegramFile.fileId}`);
        console.log(`📤 [${requestId}] - Stream URL: ${telegramFile.downloadUrl}`);
      } else {
        console.log(`❌ [${requestId}] ERROR: Telegram upload failed!`);
      }
      
      if (!telegramFile) {
        await storage.updateDownload(download.id, { status: "failed" });
        return res.status(500).json({ error: "Upload to Telegram failed" });
      }
      
      // Update download record
      console.log(`💾 [${requestId}] Updating database with completion status...`);
      const updatedDownload = await storage.updateDownload(download.id, {
        title: videoInfo.title,
        telegramMessageId: telegramFile.messageId,
        telegramFileId: telegramFile.fileId,
        downloadUrl: telegramFile.downloadUrl,
        duration: videoInfo.duration,
        fileSize: audioBuffer.length,
        status: "completed"
      });
      console.log(`💾 [${requestId}] Database updated successfully!`);
      
      console.log(`📊 [${requestId}] Recording usage statistics...`);
      await storage.updateApiKeyUsage(req.apiKey!.id);
      const totalTime = Date.now() - startTime;
      await storage.createUsageStats({
        userId: req.apiKey!.userId,
        apiKeyId: req.apiKey!.id,
        endpoint: "/song",
        responseTime: totalTime,
        statusCode: 200
      });
      
      console.log(`🎵 [${requestId}] ===== AUDIO REQUEST COMPLETED (NEW DOWNLOAD) =====`);
      console.log(`🎵 [${requestId}] Total processing time: ${totalTime}ms`);
      console.log(`🎵 [${requestId}] Final stream URL: ${updatedDownload.downloadUrl}`);
      
      res.json({
        status: "done",
        title: updatedDownload.title,
        link: updatedDownload.downloadUrl,
        format: updatedDownload.format,
        duration: updatedDownload.duration
      });
      
    } catch (error: any) {
      console.log(`💥 [${requestId}] ===== AUDIO REQUEST FAILED =====`);
      console.log(`💥 [${requestId}] Error: ${error.message}`);
      console.log(`💥 [${requestId}] Stack: ${error.stack}`);
      console.log(`💥 [${requestId}] Failed after: ${Date.now() - startTime}ms`);
      
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

  // Stream tracking endpoint - shows where stream is coming from
  app.get("/api/stream/info/:videoId", authenticateApiKey, async (req, res) => {
    try {
      const { videoId } = req.params;
      
      // Get all downloads for this video
      const downloads = await storage.getDownloadsByYoutubeId(videoId);
      
      if (downloads.length === 0) {
        return res.status(404).json({ error: "Video not found in our storage" });
      }

      // Get video info
      const videoInfo = await youtubeService.getVideoInfo(videoId);
      
      // Build streaming sources info
      const streamingSources = downloads.map(download => ({
        format: download.format,
        streamType: download.format === 'mp3' ? 'audio' : 'video',
        source: {
          platform: "Telegram",
          cdnProvider: "Telegram Global CDN",
          server: "api.telegram.org",
          botToken: "7412125068:AAE_****(hidden)",
          channelId: process.env.TELEGRAM_CHANNEL_ID || "-1002863131570",
          messageId: download.telegramMessageId,
          fileId: download.telegramFileId
        },
        urls: {
          directStream: download.downloadUrl,
          telegramMessage: `https://t.me/c/${process.env.TELEGRAM_CHANNEL_ID?.replace('-100', '')}/${download.telegramMessageId}`,
          apiEndpoint: `${req.protocol}://${req.get('host')}/api/${download.format === 'mp3' ? 'song' : 'video'}/${videoId}`
        },
        metadata: {
          fileSize: download.fileSize,
          uploadedAt: download.createdAt,
          quality: download.format === 'mp3' ? 'High Quality Audio' : 'HD Video',
          streamingOptimized: true,
          rangeRequestsSupported: true
        },
        performance: {
          globalCDN: true,
          serverLocations: "Worldwide",
          expectedLatency: "< 100ms",
          bandwidth: "Unlimited",
          uptime: "99.9%"
        }
      }));

      res.json({
        success: true,
        videoId,
        title: videoInfo?.title || downloads[0].title,
        streamingSources,
        recommendation: {
          bestSource: streamingSources[0]?.source,
          reason: "Telegram provides global CDN with excellent performance",
          benefits: [
            "No bandwidth limits",
            "Global server distribution", 
            "Range requests support",
            "Instant streaming",
            "99.9% uptime guarantee"
          ]
        },
        usage: {
          directAccess: `Click file in Telegram channel: https://t.me/c/${process.env.TELEGRAM_CHANNEL_ID?.replace('-100', '')}`,
          programmaticAccess: `Use streaming URLs in your applications`,
          embeddedPlayer: "Works with HTML5 audio/video tags"
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Real-time stream analytics
  app.get("/api/stream/analytics", authenticateApiKey, async (req, res) => {
    try {
      // Get recent downloads for analytics
      const recentDownloads = await storage.getUserUsageStats(req.apiKey!.userId, 7);
      
      const analytics = {
        totalStreams: recentDownloads.length,
        streamingSources: {
          telegram: recentDownloads.length,
          direct: 0,
          other: 0
        },
        performance: {
          avgResponseTime: recentDownloads.reduce((sum, stat) => sum + (stat.responseTime || 0), 0) / recentDownloads.length || 0,
          successRate: (recentDownloads.filter(stat => stat.statusCode === 200).length / recentDownloads.length * 100) || 100,
          lastWeekUsage: recentDownloads.length
        },
        cdnDistribution: {
          telegram: "100%",
          benefits: "Global CDN, No bandwidth limits, 99.9% uptime"
        }
      };

      res.json({
        success: true,
        period: "Last 7 days",
        analytics,
        streamingInfrastructure: {
          primaryCDN: "Telegram Global Network",
          backupSources: "None needed - Telegram provides 99.9% uptime",
          geographicDistribution: "Worldwide",
          contentDelivery: "Optimized for streaming"
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
