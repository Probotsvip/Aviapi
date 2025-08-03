import ytdl from "ytdl-core";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const execAsync = promisify(exec);

interface VideoInfo {
  title: string;
  duration: string;
  thumbnail: string;
}

class YouTubeService {
  private tempDir = "/tmp/tubeapi";

  constructor() {
    // Ensure temp directory exists
    this.ensureTempDir();
  }

  private async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create temp directory:", error);
    }
  }

  async getVideoInfo(videoId: string): Promise<VideoInfo | null> {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      
      // Try with yt-dlp first for better reliability
      try {
        const { stdout } = await execAsync(`yt-dlp --dump-json "${url}"`);
        const info = JSON.parse(stdout);
        
        return {
          title: this.sanitizeTitle(info.title || `Video_${videoId}`),
          duration: this.formatDuration(info.duration || 0),
          thumbnail: info.thumbnail || ""
        };
      } catch (ytDlpError) {
        console.warn("yt-dlp failed, falling back to ytdl-core:", ytDlpError);
        
        // Fallback to ytdl-core
        const info = await ytdl.getInfo(url);
        const duration = this.formatDuration(parseInt(info.videoDetails.lengthSeconds));
        
        return {
          title: this.sanitizeTitle(info.videoDetails.title || `Video_${videoId}`),
          duration,
          thumbnail: info.videoDetails.thumbnails[0]?.url || ""
        };
      }
    } catch (error) {
      console.error("Failed to get video info:", error);
      return null;
    }
  }

  async downloadAudio(videoId: string): Promise<Buffer | null> {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const fileName = `audio_${videoId}_${randomBytes(4).toString('hex')}`;
      const outputPath = path.join(this.tempDir, fileName);
      
      console.log(`Downloading high-quality audio for video ${videoId}`);
      
      // Download highest quality audio with yt-dlp
      const command = `yt-dlp -f "bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio" --extract-audio --audio-format mp3 --audio-quality 0 -o "${outputPath}.%(ext)s" "${url}"`;
      
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
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const fileName = `video_${videoId}_${randomBytes(4).toString('hex')}`;
      const outputPath = path.join(this.tempDir, fileName);
      
      console.log(`Downloading high-quality video for ${videoId} at ${quality}`);
      
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
      
      const command = `yt-dlp -f "${formatSelector}" -o "${outputPath}.%(ext)s" "${url}"`;
      
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
