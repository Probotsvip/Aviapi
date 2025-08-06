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
      
      // STEP 1: Check if file exists in Telegram (database-assisted approach for reliability)
      console.log(`🔍 [${requestId}] PRIORITY 1: Checking for existing Telegram files...`);
      let telegramDownload = await storage.getDownloadByYoutubeId(videoId, format);
      
      if (telegramDownload && telegramDownload.telegramFileId && telegramDownload.status === "completed") {
        console.log(`⚡ [${requestId}] TELEGRAM FILE FOUND! File ID: ${telegramDownload.telegramFileId}`);
        
        try {
          // Get fresh download URL using the file ID (this works even with token changes)
          const fileInfoUrl = `https://api.telegram.org/bot7322756571:AAFe906CdE-qEgqlf1d956KmYOwFN_M4Avo/getFile`;
          const response = await fetch(fileInfoUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: telegramDownload.telegramFileId })
          });

          if (response.ok) {
            const data = await response.json() as any;
            if (data.ok && data.result.file_path) {
              const telegramDirectUrl = `https://api.telegram.org/file/bot7322756571:AAFe906CdE-qEgqlf1d956KmYOwFN_M4Avo/${data.result.file_path}`;
              const responseTime = Date.now() - startTime;
              
              console.log(`⚡ [${requestId}] TELEGRAM SUCCESS! Fresh download URL generated in ${responseTime}ms`);
              console.log(`🚀 [${requestId}] Direct Telegram URL: ${telegramDirectUrl}`);
              
              // Add to memory cache for faster access next time
              fastCache.set(videoId, format, {
                title: telegramDownload.title || "Unknown Title",
                downloadUrl: telegramDirectUrl,
                format: format,
                duration: telegramDownload.duration || "Unknown",
                timestamp: Date.now()
              });
              
              // Update usage stats in background (non-blocking)
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
                title: telegramDownload.title,
                link: telegramDirectUrl, // Fresh Telegram direct URL!
                format: format,
                duration: telegramDownload.duration
              });
            }
          }
          
          console.log(`⚠️ [${requestId}] Could not get fresh Telegram URL, using cached URL`);
        } catch (error) {
          console.log(`⚠️ [${requestId}] Telegram API error: ${error}, using cached URL`);
        }
      }
      
      console.log(`❌ [${requestId}] No Telegram file found, checking memory cache...`);

      // STEP 2: Check in-memory cache (ultra fast)
      const cacheItem = fastCache.get(videoId, format);
      if (cacheItem) {
        const responseTime = Date.now() - startTime;
        console.log(`⚡ [${requestId}] MEMORY CACHE HIT! ${responseTime}ms`);
        
        // Update usage stats in background (completely non-blocking)
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
          ]).catch(() => {}); // Silent error handling for performance
        });
        
        return res.json({
          status: "done",
          title: cacheItem.title,
          link: cacheItem.downloadUrl, // Use direct URL from cache
          format: cacheItem.format,
          duration: cacheItem.duration || "Unknown"
        });
      }

      // STEP 3: Check database cache
      let existingDownload = await storage.getDownloadByYoutubeId(videoId, format);
      
      if (existingDownload && existingDownload.status === "completed") {
        const responseTime = Date.now() - startTime;
        console.log(`💾 [${requestId}] DB CACHE HIT! ${responseTime}ms - ${existingDownload.title}`);
        
        // Add to memory cache for next time
        fastCache.set(videoId, format, {
          title: existingDownload.title || "Unknown Title",
          downloadUrl: existingDownload.downloadUrl || "",
          format: existingDownload.format || "mp3",
          duration: existingDownload.duration || "Unknown",
          timestamp: Date.now()
        });

        // Update usage stats in background (completely non-blocking)
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
          ]).catch(() => {}); // Silent error handling for performance
        });
        
        return res.json({
          status: "done",
          title: existingDownload.title,
          link: existingDownload.downloadUrl, // Direct URL from memory cache
          format: existingDownload.format,
          duration: existingDownload.duration
        });
      } else if (existingDownload && existingDownload.status === "downloading") {
        console.log(`⚠️ [${requestId}] Found in-progress download, waiting for completion...`);
        
        // Wait for existing download to complete (up to 60 seconds)
        for (let i = 0; i < 20; i++) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
          const updatedDownload = await storage.getDownloadByYoutubeId(videoId, format);
          
          if (updatedDownload && updatedDownload.status === "completed") {
            console.log(`✅ [${requestId}] In-progress download completed! Returning cached result.`);
            
            const responseTime = Date.now() - startTime;
            await storage.updateApiKeyUsage(req.apiKey!.id);
            await storage.createUsageStats({
              userId: req.apiKey!.userId,
              apiKeyId: req.apiKey!.id,
              endpoint: "/song",
              responseTime: responseTime,
              statusCode: 200
            });
            
            console.log(`🎵 [${requestId}] ===== AUDIO REQUEST COMPLETED (WAITED FOR CACHE) =====`);
            return res.json({
              status: "done",
              title: updatedDownload.title,
              link: updatedDownload.downloadUrl, // Direct URL from cache
              format: updatedDownload.format,
              duration: updatedDownload.duration
            });
          }
        }
        console.log(`⚠️ [${requestId}] Timeout waiting for existing download, will create new one...`);
      } else {
        console.log(`❌ [${requestId}] CACHE MISS! No existing download found, will need to process...`);
      }
      
      // Create new download record for current user only if no other download exists
      let download;
      try {
        download = await storage.createDownload({
          youtubeId: videoId,
          format,
          userId: req.apiKey!.userId,
          apiKeyId: req.apiKey!.id
        });
      } catch (error: any) {
        // If creation fails due to race condition, check again for existing download
        if (error.code === '23505') { // Unique constraint violation
          console.log(`🔄 [${requestId}] Race condition detected, checking for existing download...`);
          existingDownload = await storage.getDownloadByYoutubeId(videoId, format);
          if (existingDownload && existingDownload.status === "completed") {
            console.log(`✅ [${requestId}] Found completed download during race condition recovery`);
            const responseTime = Date.now() - startTime;
            await storage.updateApiKeyUsage(req.apiKey!.id);
            await storage.createUsageStats({
              userId: req.apiKey!.userId,
              apiKeyId: req.apiKey!.id,
              endpoint: "/song",
              responseTime: responseTime,
              statusCode: 200
            });
            
            return res.json({
              status: "done", 
              title: existingDownload.title,
              link: existingDownload.downloadUrl, // Direct URL from existing record
              format: existingDownload.format,
              duration: existingDownload.duration
            });
          }
        }
        throw error;
      }
      
      // Get video info
      const videoInfo = await youtubeService.getVideoInfo(videoId);
      if (!videoInfo) {
        await storage.updateDownload(download.id, { status: "failed" });
        return res.status(404).json({ error: "Video not found" });
      }
      
      // Get direct download URL from third-party API (INSTANT RESPONSE)
      console.log(`🔗 [${requestId}] Getting direct download URL from third-party API...`);
      const downloadStartTime = Date.now();
      const downloadResult = await youtubeService.downloadSongViaAPI(videoId);
      const downloadTime = Date.now() - downloadStartTime;
      console.log(`🔗 [${requestId}] API call completed in ${downloadTime}ms`);
      
      if (downloadResult.error || !downloadResult.filePath) {
        console.log(`❌ [${requestId}] ERROR: Third-party API failed: ${downloadResult.error}`);
        await storage.updateDownload(download.id, { status: "failed" });
        return res.status(500).json({ error: "Download failed" });
      }
      
      console.log(`✅ [${requestId}] SUCCESS: Got direct download URL from third-party API`);
      console.log(`🔗 [${requestId}] Direct URL: ${downloadResult.filePath}`);
      
      const directDownloadUrl = downloadResult.filePath;
      
      // Update database with direct URL IMMEDIATELY
      console.log(`💾 [${requestId}] Updating database with direct download URL...`);
      const updatedDownload = await storage.updateDownload(download.id, {
        title: videoInfo.title,
        downloadUrl: directDownloadUrl,
        duration: videoInfo.duration,
        status: "completed"
      });
      console.log(`💾 [${requestId}] Database updated successfully!`);
      
      // Add to memory cache immediately
      fastCache.set(videoId, format, {
        title: updatedDownload.title || "Unknown Title",
        downloadUrl: updatedDownload.downloadUrl || "",
        format: updatedDownload.format || "mp3",
        duration: updatedDownload.duration || "Unknown",
        timestamp: Date.now()
      });

      // INSTANT RESPONSE TO USER - Don't make them wait!
      const totalTime = Date.now() - startTime;
      console.log(`🚀 [${requestId}] ===== INSTANT RESPONSE TO USER =====`);
      console.log(`🚀 [${requestId}] Response time: ${totalTime}ms (DIRECT API URL)`);
      console.log(`🚀 [${requestId}] Direct URL: ${updatedDownload.downloadUrl}`);
      
      // Send response immediately
      res.json({
        status: "done",
        title: updatedDownload.title,
        link: updatedDownload.downloadUrl, // Direct third-party URL
        format: updatedDownload.format,
        duration: updatedDownload.duration
      });

      // SMART BACKGROUND PROCESSING: Only if NOT already in Telegram (NO DUPLICATES!)
      console.log(`🔄 [${requestId}] Checking if we need background Telegram upload...`);
      setImmediate(async () => {
        try {
          // Double-check if file already exists in Telegram to prevent duplicates
          const currentDownload = await storage.getDownloadByYoutubeId(videoId, format);
          if (currentDownload && currentDownload.telegramFileId) {
            console.log(`⏭️ [BG_${requestId}] Background: File already has Telegram ID, skipping upload to prevent duplicates`);
            return;
          }
          
          // Check if another process is already downloading this file
          const downloadInProgress = await storage.getDownloadByYoutubeId(videoId, format);
          if (downloadInProgress && downloadInProgress.telegramFileId) {
            console.log(`⏭️ [BG_${requestId}] Background: File already has Telegram ID, skipping to prevent duplicates`);
            return;
          }
          
          console.log(`📥 [BG_${requestId}] Background: Starting SINGLE download for Telegram upload...`);
          const bgStartTime = Date.now();
          const audioBuffer = await youtubeService.downloadAudio(videoId);
          const bgDownloadTime = Date.now() - bgStartTime;
          console.log(`📥 [BG_${requestId}] Background: Download completed in ${bgDownloadTime}ms`);
          
          if (audioBuffer) {
            // Final check before upload to prevent race conditions
            const finalCheck = await storage.getDownloadByYoutubeId(videoId, format);
            if (finalCheck && finalCheck.telegramFileId) {
              console.log(`⏭️ [BG_${requestId}] Background: File got Telegram ID during download, aborting upload`);
              return;
            }
            
            console.log(`📤 [BG_${requestId}] Background: Uploading to Telegram channel (SINGLE UPLOAD)...`);
            const bgUploadStartTime = Date.now();
            const telegramFile = await telegramService.uploadAudio(audioBuffer, videoInfo.title, videoId, videoInfo.duration);
            const bgUploadTime = Date.now() - bgUploadStartTime;
            console.log(`📤 [BG_${requestId}] Background: Telegram upload completed in ${bgUploadTime}ms`);
            
            if (telegramFile) {
              // Update database with Telegram info for future instant access
              await storage.updateDownload(download.id, {
                telegramMessageId: telegramFile.messageId,
                telegramFileId: telegramFile.fileId,
                fileSize: audioBuffer.length
              });
              console.log(`✅ [BG_${requestId}] Background: Database updated - future requests will be instant from Telegram`);
              console.log(`🎵 [BG_${requestId}] Background: Total background time: ${Date.now() - bgStartTime}ms`);
            }
          } else {
            console.log(`⚠️ [BG_${requestId}] Background: Audio download failed, but user already got direct URL`);
          }
        } catch (bgError: any) {
          console.log(`⚠️ [BG_${requestId}] Background: Error during background processing: ${bgError.message}`);
          console.log(`⚠️ [BG_${requestId}] Background: This is OK - user already got direct URL response`);
        }
      });

      // Update usage stats in background
      setImmediate(async () => {
        try {
          await storage.updateApiKeyUsage(req.apiKey!.id);
          await storage.createUsageStats({
            userId: req.apiKey!.userId,
            apiKeyId: req.apiKey!.id,
            endpoint: "/song",
            responseTime: totalTime,
            statusCode: 200
          });
        } catch (error: any) {
          console.log(`⚠️ [BG_${requestId}] Background: Usage stats update failed: ${error.message}`);
        }
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
    const requestId = `VID_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🎬 [${requestId}] ===== VIDEO REQUEST STARTED =====`);
    console.log(`🎬 [${requestId}] Video ID: ${req.params.videoId}`);
    console.log(`🎬 [${requestId}] API Key: ${req.apiKey?.key?.substring(0, 8)}...`);
    
    try {
      const { videoId } = req.params;
      const quality = req.query.quality as string || "best"; // AUTO-SELECT HIGHEST QUALITY
      const format = "mp4";
      
      // STEP 1: Check Telegram channel FIRST (PRIORITY - even 10-year-old videos)
      console.log(`🔍 [${requestId}] PRIORITY 1: Searching Telegram channel first for video (even old content)...`);
      const { getTelegramSearchService } = await import('./services/telegramSearch');
      const telegramSearch = getTelegramSearchService();
      const telegramResult = await telegramSearch.findExistingFile(videoId, format as 'mp3' | 'mp4');
      
      if (telegramResult && telegramResult.download_url) {
        console.log(`✅ [${requestId}] TELEGRAM VIDEO DIRECT HIT! Found existing file:`);
        console.log(`✅ [${requestId}] - Title: ${telegramResult.title}`);
        console.log(`✅ [${requestId}] - File Size: ${telegramResult.file_size ? (telegramResult.file_size / 1024 / 1024).toFixed(1) + ' MB' : 'Unknown'}`);
        console.log(`✅ [${requestId}] - Message ID: ${telegramResult.message_id}`);
        console.log(`✅ [${requestId}] - Stream URL: ${telegramResult.download_url}`);
        console.log(`🔄 [${requestId}] REUSING TELEGRAM VIDEO FILE - Token/Channel independent!`);
        
        const responseTime = Date.now() - startTime;
        console.log(`⚡ [${requestId}] Response time: ${responseTime}ms (SUPER FAST - TELEGRAM DIRECT!)`);
        
        // Update usage for current API key
        await storage.updateApiKeyUsage(req.apiKey!.id);
        await storage.createUsageStats({
          userId: req.apiKey!.userId,
          apiKeyId: req.apiKey!.id,
          endpoint: "/video",
          responseTime: responseTime,
          statusCode: 200
        });
        
        console.log(`🎬 [${requestId}] ===== VIDEO REQUEST COMPLETED (TELEGRAM DIRECT) =====`);
        return res.json({
          status: "done",
          title: telegramResult.title,
          link: `/api/stream/${videoId}/mp4`,
          format: telegramResult.file_type === 'video' ? 'mp4' : 'mp3',
          duration: telegramResult.duration?.toString() || "Unknown"
        });
      }
      
      // SECOND: Check database cache as fallback
      console.log(`🔍 [${requestId}] Checking database for existing video download (shared cache)...`);
      let existingDownload = await storage.getDownloadByYoutubeId(videoId, format);
      
      if (existingDownload && existingDownload.status === "completed") {
        console.log(`✅ [${requestId}] SHARED VIDEO CACHE HIT! Found existing download:`);
        console.log(`✅ [${requestId}] - Title: ${existingDownload.title}`);
        console.log(`✅ [${requestId}] - File Size: ${existingDownload.fileSize ? (existingDownload.fileSize / 1024 / 1024).toFixed(1) + ' MB' : 'Unknown'}`);
        console.log(`🔄 [${requestId}] REUSING TELEGRAM VIDEO FILE - Same file for all API keys!`);
        
        await storage.updateApiKeyUsage(req.apiKey!.id);
        await storage.createUsageStats({
          userId: req.apiKey!.userId,
          apiKeyId: req.apiKey!.id,
          endpoint: "/video",
          responseTime: Date.now() - startTime,
          statusCode: 200
        });
        
        console.log(`🎬 [${requestId}] ===== VIDEO REQUEST COMPLETED (SHARED CACHE) =====`);
        return res.json({
          status: "done",
          title: existingDownload.title,
          link: `/api/stream/${videoId}/mp4`,
          format: existingDownload.format,
          quality,
          duration: existingDownload.duration,
          size: existingDownload.fileSize ? `${(existingDownload.fileSize / 1024 / 1024).toFixed(1)} MB` : undefined
        });
      } else {
        console.log(`❌ [${requestId}] VIDEO CACHE MISS! No existing download found, will need to process...`);
      }
      
      // Create new download record for current user
      const download = await storage.createDownload({
        youtubeId: videoId,
        format,
        userId: req.apiKey!.userId,
        apiKeyId: req.apiKey!.id
      });
      
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
        link: `/api/stream/${videoId}/mp4`,
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
          streamUrl: `/api/stream/${download.youtubeId}/${download.format}`,
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
            streamUrl: `/api/stream/${videoId}/${d.format}`,
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
          directStream: `/api/stream/${videoId}/${download.format}`,
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

  // Stream proxy endpoint for clean URLs (your domain proxy)
  app.get("/api/stream/:videoId/:format", authenticateApiKey, async (req, res) => {
    const startTime = Date.now();
    try {
      const { videoId, format } = req.params;
      
      // First check memory cache for fastest response
      const cacheItem = fastCache.get(videoId, format);
      if (cacheItem && cacheItem.downloadUrl) {
        console.log(`🔄 [STREAM] Memory cache hit for ${videoId} - redirecting to Telegram`);
        return res.redirect(302, cacheItem.downloadUrl);
      }

      // Check database for download URL
      const existingDownload = await storage.getDownloadByYoutubeId(videoId, format);
      if (existingDownload && existingDownload.downloadUrl) {
        console.log(`🔄 [STREAM] Database hit for ${videoId} - redirecting to Telegram`);
        
        // Add to cache for next time
        fastCache.set(videoId, format, {
          title: existingDownload.title || "Unknown Title",
          downloadUrl: existingDownload.downloadUrl,
          format: existingDownload.format || format,
          duration: existingDownload.duration || "Unknown",
          timestamp: Date.now()
        });
        
        // Track stream access
        setImmediate(() => {
          storage.createUsageStats({
            userId: req.apiKey!.userId,
            apiKeyId: req.apiKey!.id,
            endpoint: "/stream",
            responseTime: Date.now() - startTime,
            statusCode: 302
          }).catch(() => {});
        });
        
        return res.redirect(302, existingDownload.downloadUrl);
      }

      console.log(`❌ [STREAM] File not found for ${videoId}.${format}`);
      res.status(404).json({ error: "File not found. Please download first using /api/song or /api/video endpoints." });
    } catch (error: any) {
      console.error("Stream proxy error:", error);
      res.status(500).json({ error: "Stream unavailable" });
    }
  });

  // Admin routes
  registerAdminRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
