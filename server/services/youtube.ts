import ytdl from "ytdl-core";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import fetch from "node-fetch";

const execAsync = promisify(exec);

// Configuration for external API calls (as per user's existing code)
const API_URL = process.env.API_URL || "https://api.cobalt.tools";
const VIDEO_API_URL = process.env.VIDEO_API_URL || "https://api.cobalt.tools";
const API_KEY = process.env.EXTERNAL_API_KEY || "";

interface VideoInfo {
  title: string;
  duration: string;
  thumbnail: string;
  videoId: string;
}

interface DownloadResult {
  filePath?: string;
  buffer?: Buffer;
  isDirect: boolean;
  error?: string;
}

class YouTubeService {
  private tempDir = "/tmp/tubeapi";
  private downloadsDir = "downloads";

  constructor() {
    // Ensure directories exist
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.downloadsDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create directories:", error);
    }
  }

  private getCookieFile(): string | null {
    try {
      const cookieDir = path.join(process.cwd(), "cookies");
      if (!require('fs').existsSync(cookieDir)) {
        return null;
      }
      const cookieFiles = require('fs').readdirSync(cookieDir).filter((f: string) => f.endsWith('.txt'));
      if (cookieFiles.length === 0) {
        return null;
      }
      return path.join(cookieDir, cookieFiles[Math.floor(Math.random() * cookieFiles.length)]);
    } catch (error) {
      console.error("Error getting cookie file:", error);
      return null;
    }
  }

  async getVideoInfo(videoId: string): Promise<VideoInfo | null> {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      
      // Try with yt-dlp first (with cookies if available)
      try {
        const cookieFile = this.getCookieFile();
        const cookieFlag = cookieFile ? `--cookies "${cookieFile}"` : '';
        const { stdout } = await execAsync(`yt-dlp ${cookieFlag} --dump-json "${url}"`);
        const info = JSON.parse(stdout);
        
        return {
          title: this.sanitizeTitle(info.title || `Video_${videoId}`),
          duration: this.formatDuration(info.duration || 0),
          thumbnail: info.thumbnail || "",
          videoId
        };
      } catch (ytDlpError) {
        console.warn("yt-dlp failed, falling back to ytdl-core:", ytDlpError);
        
        // Fallback to ytdl-core
        const info = await ytdl.getInfo(url);
        const duration = this.formatDuration(parseInt(info.videoDetails.lengthSeconds));
        
        return {
          title: this.sanitizeTitle(info.videoDetails.title || `Video_${videoId}`),
          duration,
          thumbnail: info.videoDetails.thumbnails[0]?.url || "",
          videoId
        };
      }
    } catch (error) {
      console.error("Failed to get video info:", error);
      return null;
    }
  }

  // External API download methods (as per user's existing code)
  async downloadSongViaAPI(videoId: string): Promise<DownloadResult> {
    try {
      const filePath = path.join(this.downloadsDir, `${videoId}.mp3`);
      
      // Check if file already exists
      if (await this.fileExists(filePath)) {
        console.log(`File already exists: ${filePath}`);
        const buffer = await fs.readFile(filePath);
        return { buffer, isDirect: true };
      }

      if (!API_KEY) {
        throw new Error("External API key not configured");
      }

      const songUrl = `${API_URL}/song/${videoId}?api=${API_KEY}`;
      
      // Poll API for download status
      for (let attempt = 0; attempt < 10; attempt++) {
        const response = await fetch(songUrl);
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json() as any;
        const status = data.status?.toLowerCase();

        if (status === "done") {
          const downloadUrl = data.link;
          if (!downloadUrl) {
            throw new Error("API response did not provide a download URL");
          }

          // Download the file
          const fileResponse = await fetch(downloadUrl);
          const buffer = Buffer.from(await fileResponse.arrayBuffer());
          
          // Save to local cache
          await fs.writeFile(filePath, buffer);
          
          return { buffer, isDirect: true };
        } else if (status === "downloading") {
          await new Promise(resolve => setTimeout(resolve, 4000));
        } else {
          const errorMsg = data.error || data.message || `Unexpected status '${status}'`;
          throw new Error(`API error: ${errorMsg}`);
        }
      }

      throw new Error("Max retries reached. Still downloading...");
    } catch (error) {
      console.error("External API song download failed:", error);
      return { isDirect: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async downloadVideoViaAPI(videoId: string): Promise<DownloadResult> {
    try {
      const filePath = path.join(this.downloadsDir, `${videoId}.mp4`);
      
      // Check if file already exists
      if (await this.fileExists(filePath)) {
        console.log(`File already exists: ${filePath}`);
        const buffer = await fs.readFile(filePath);
        return { buffer, isDirect: true };
      }

      if (!API_KEY) {
        throw new Error("External API key not configured");
      }

      const videoUrl = `${VIDEO_API_URL}/video/${videoId}?api=${API_KEY}`;
      
      // Poll API for download status
      for (let attempt = 0; attempt < 10; attempt++) {
        const response = await fetch(videoUrl);
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json() as any;
        const status = data.status?.toLowerCase();

        if (status === "done") {
          const downloadUrl = data.link;
          if (!downloadUrl) {
            throw new Error("API response did not provide a download URL");
          }

          // Download the file
          const fileResponse = await fetch(downloadUrl);
          const buffer = Buffer.from(await fileResponse.arrayBuffer());
          
          // Save to local cache
          await fs.writeFile(filePath, buffer);
          
          return { buffer, isDirect: true };
        } else if (status === "downloading") {
          await new Promise(resolve => setTimeout(resolve, 8000));
        } else {
          const errorMsg = data.error || data.message || `Unexpected status '${status}'`;
          throw new Error(`API error: ${errorMsg}`);
        }
      }

      throw new Error("Max retries reached. Still downloading...");
    } catch (error) {
      console.error("External API video download failed:", error);
      return { isDirect: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async downloadAudio(videoId: string): Promise<Buffer | null> {
    try {
      // Try external API first
      console.log(`Attempting audio download via external API for ${videoId}`);
      const apiResult = await this.downloadSongViaAPI(videoId);
      if (apiResult.buffer) {
        console.log(`Audio download successful via API: ${apiResult.buffer.length} bytes`);
        return apiResult.buffer;
      }
      
      console.log("API download failed, falling back to yt-dlp");
      
      // Fallback to yt-dlp with cookies
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const fileName = `audio_${videoId}_${randomBytes(4).toString('hex')}`;
      const outputPath = path.join(this.tempDir, fileName);
      
      const cookieFile = this.getCookieFile();
      const cookieFlag = cookieFile ? `--cookies "${cookieFile}"` : '';
      
      console.log(`Downloading high-quality audio for video ${videoId} with yt-dlp`);
      
      // Download highest quality audio with yt-dlp
      const command = `yt-dlp ${cookieFlag} -f "bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio" --extract-audio --audio-format mp3 --audio-quality 0 -o "${outputPath}.%(ext)s" "${url}"`;
      
      await execAsync(command, { timeout: 300000 }); // 5 minute timeout
      
      // Find the downloaded file (yt-dlp may change extension)
      const files = await fs.readdir(this.tempDir);
      const audioFile = files.find(f => f.startsWith(fileName));
      
      if (!audioFile) {
        throw new Error("Downloaded file not found");
      }
      
      const fullPath = path.join(this.tempDir, audioFile);
      const buffer = await fs.readFile(fullPath);
      
      // Clean up temp file
      await fs.unlink(fullPath).catch(() => {});
      
      console.log(`Audio download completed: ${buffer.length} bytes`);
      return buffer;
      
    } catch (error) {
      console.error("Failed to download audio:", error);
      return null;
    }
  }

  async downloadVideo(videoId: string, quality: string = "720p"): Promise<Buffer | null> {
    try {
      // Try external API first
      console.log(`Attempting video download via external API for ${videoId}`);
      const apiResult = await this.downloadVideoViaAPI(videoId);
      if (apiResult.buffer) {
        console.log(`Video download successful via API: ${apiResult.buffer.length} bytes`);
        return apiResult.buffer;
      }

      console.log("API download failed, falling back to yt-dlp");
      
      // Fallback to yt-dlp with cookies
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const fileName = `video_${videoId}_${randomBytes(4).toString('hex')}`;
      const outputPath = path.join(this.tempDir, fileName);
      
      const cookieFile = this.getCookieFile();
      const cookieFlag = cookieFile ? `--cookies "${cookieFile}"` : '';
      
      console.log(`Downloading high-quality video for ${videoId} at ${quality} with yt-dlp`);
      
      // Map quality to yt-dlp format selector
      let formatSelector = "best[ext=mp4]";
      switch (quality) {
        case "4K":
        case "2160p":
          formatSelector = "best[height<=2160][ext=mp4]/best[ext=mp4]";
          break;
        case "1440p":
          formatSelector = "best[height<=1440][ext=mp4]/best[ext=mp4]";
          break;
        case "1080p":
          formatSelector = "best[height<=1080][ext=mp4]/best[ext=mp4]";
          break;
        case "720p":
          formatSelector = "best[height<=720][ext=mp4]/best[ext=mp4]";
          break;
        case "480p":
          formatSelector = "best[height<=480][ext=mp4]/best[ext=mp4]";
          break;
        default:
          formatSelector = "best[ext=mp4]";
      }
      
      const command = `yt-dlp ${cookieFlag} -f "${formatSelector}" -o "${outputPath}.%(ext)s" "${url}"`;
      
      await execAsync(command, { timeout: 600000 }); // 10 minute timeout for video
      
      // Find the downloaded file
      const files = await fs.readdir(this.tempDir);
      const videoFile = files.find(f => f.startsWith(fileName));
      
      if (!videoFile) {
        throw new Error("Downloaded file not found");
      }
      
      const fullPath = path.join(this.tempDir, videoFile);
      const buffer = await fs.readFile(fullPath);
      
      // Clean up temp file
      await fs.unlink(fullPath).catch(() => {});
      
      console.log(`Video download completed: ${buffer.length} bytes`);
      return buffer;
      
    } catch (error) {
      console.error("Failed to download video:", error);
      return null;
    }
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private sanitizeTitle(title: string): string {
    // Remove special characters that might cause issues
    return title
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100); // Limit length
  }
}

export const youtubeService = new YouTubeService();
