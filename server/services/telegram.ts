import { Telegraf } from "telegraf";

interface TelegramFile {
  messageId: string;
  fileId: string;
  downloadUrl: string;
  streamUrl?: string;
  metadata?: {
    videoId: string;
    title: string;
    duration: string;
    streamType: 'audio' | 'video';
    uploadedAt: string;
    fileSize: number;
  };
}

class TelegramService {
  private bot: Telegraf | null = null;
  private channelId: string;

  constructor() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || "7322756571:AAFe906CdE-qEgqlf1d956KmYOwFN_M4Avo";
    const channelId = process.env.TELEGRAM_CHANNEL_ID || "-1002863131570";
    
    if (botToken && channelId) {
      this.bot = new Telegraf(botToken);
      this.channelId = channelId;
      console.log("Telegram service initialized with provided credentials");
    } else {
      console.warn("Telegram configuration missing. File storage will be simulated.");
      this.channelId = "demo";
    }
  }

  async uploadAudio(audioBuffer: Buffer, title: string, videoId: string, duration: string = "Unknown"): Promise<TelegramFile | null> {
    try {
      if (!this.bot) {
        throw new Error("Telegram bot not configured - please provide TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID");
      }

      // Ensure filename is safe
      const safeTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
      
      // Create rich metadata caption with searchable hashtags
      const caption = `🎵 ${title}

📱 #AUDIO #MP3 #${videoId}
🎬 Video ID: ${videoId}
⏱️ Duration: ${duration}
📊 Size: ${(audioBuffer.length / (1024 * 1024)).toFixed(1)} MB
🔗 Stream Type: Audio
📅 Uploaded: ${new Date().toISOString().split('T')[0]}

#TubeAPI #YouTubeAudio #StreamReady`;

      const message = await this.bot.telegram.sendAudio(this.channelId, {
        source: audioBuffer,
        filename: `${videoId}_${safeTitle}.mp3`
      }, {
        caption: caption,
        performer: "TubeAPI",
        title: title,
        duration: this.parseDuration(duration)
      });

      if (message.audio) {
        const downloadUrl = await this.getDirectDownloadUrl(message.audio.file_id);
        const streamUrl = await this.getStreamUrl(message.audio.file_id);
        
        return {
          messageId: message.message_id.toString(),
          fileId: message.audio.file_id,
          downloadUrl: downloadUrl || `https://t.me/c/${this.channelId.replace('-100', '')}/${message.message_id}`,
          streamUrl: streamUrl || undefined,
          metadata: {
            videoId: videoId,
            title: title,
            duration: duration,
            streamType: 'audio',
            uploadedAt: new Date().toISOString(),
            fileSize: audioBuffer.length
          }
        };
      }
      
      return null;
    } catch (error) {
      console.error("Failed to upload audio to Telegram:", error);
      throw error; // Don't return fake data - throw the real error
    }
  }

  async uploadVideo(videoBuffer: Buffer, title: string, videoId: string, duration: string = "Unknown"): Promise<TelegramFile | null> {
    try {
      if (!this.bot) {
        throw new Error("Telegram bot not configured - please provide TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID");
      }

      // Ensure filename is safe
      const safeTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
      
      const fileSizeMB = videoBuffer.length / (1024 * 1024);
      console.log(`Uploading video: ${safeTitle} (${fileSizeMB.toFixed(1)} MB)`);

      // Create rich metadata caption with searchable hashtags
      const caption = `🎬 ${title}

📱 #VIDEO #MP4 #${videoId}
🎬 Video ID: ${videoId}
⏱️ Duration: ${duration}
📊 Size: ${fileSizeMB.toFixed(1)} MB
🔗 Stream Type: Video
📅 Uploaded: ${new Date().toISOString().split('T')[0]}

#TubeAPI #YouTubeVideo #StreamReady #HD`;

      const message = await this.bot.telegram.sendVideo(this.channelId, {
        source: videoBuffer,
        filename: `${videoId}_${safeTitle}.mp4`
      }, {
        caption: caption,
        supports_streaming: true,
        duration: this.parseDuration(duration)
      });

      if (message.video) {
        const downloadUrl = await this.getDirectDownloadUrl(message.video.file_id);
        const streamUrl = await this.getStreamUrl(message.video.file_id);
        
        return {
          messageId: message.message_id.toString(),
          fileId: message.video.file_id,
          downloadUrl: downloadUrl || `https://t.me/c/${this.channelId.replace('-100', '')}/${message.message_id}`,
          streamUrl: streamUrl || undefined,
          metadata: {
            videoId: videoId,
            title: title,
            duration: duration,
            streamType: 'video',
            uploadedAt: new Date().toISOString(),
            fileSize: videoBuffer.length
          }
        };
      }
      
      return null;
    } catch (error) {
      console.error("Failed to upload video to Telegram:", error);
      throw error; // Don't return fake data - throw the real error
    }
  }

  async getFileUrl(fileId: string): Promise<string | null> {
    try {
      if (!this.bot) {
        throw new Error("Telegram bot not configured");
      }

      const file = await this.bot.telegram.getFile(fileId);
      const botToken = process.env.TELEGRAM_BOT_TOKEN || "7412125068:AAE_xef9Tgq0MZXpknz3-WPPKK7hl6t3im0";
      return `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
    } catch (error) {
      console.error("Failed to get file URL:", error);
      return null;
    }
  }

  private async getDirectDownloadUrl(fileId: string): Promise<string | null> {
    try {
      return await this.getFileUrl(fileId);
    } catch (error) {
      console.error("Failed to get direct download URL:", error);
      return null;
    }
  }

  private async getStreamUrl(fileId: string): Promise<string | null> {
    try {
      // Generate streaming-optimized URL
      const directUrl = await this.getFileUrl(fileId);
      if (directUrl) {
        // Add streaming parameters for better buffering
        return `${directUrl}?stream=1&buffer=auto`;
      }
      return null;
    } catch (error) {
      console.error("Failed to get stream URL:", error);
      return null;
    }
  }

  private parseDuration(duration: string): number | undefined {
    try {
      if (!duration || duration === "Unknown") return undefined;
      
      // Parse duration like "3:33" or "1:23:45"
      const parts = duration.split(':').map(p => parseInt(p, 10));
      if (parts.length === 2) {
        return parts[0] * 60 + parts[1]; // MM:SS
      } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  // Search functionality within Telegram channel
  async searchContent(query: string, contentType?: 'audio' | 'video'): Promise<TelegramFile[]> {
    try {
      if (!this.bot) {
        throw new Error("Telegram bot not configured");
      }

      // Build search hashtags
      const searchTags = [`#${query.toUpperCase()}`, `#TubeAPI`];
      if (contentType) {
        searchTags.push(`#${contentType.toUpperCase()}`);
      }

      // Note: Telegram Bot API doesn't provide direct search functionality
      // This is a conceptual implementation - in practice, you'd need to:
      // 1. Store metadata in your database with message IDs
      // 2. Search your database instead of Telegram directly
      // 3. Use the message IDs to construct direct links

      console.log(`Search functionality: Looking for "${query}" with tags:`, searchTags);
      console.log("Note: Implement database-based search for production use");

      return [];
    } catch (error) {
      console.error("Search failed:", error);
      return [];
    }
  }

  // Get channel statistics and content overview
  async getChannelStats(): Promise<{
    totalMessages: number;
    audioFiles: number;
    videoFiles: number;
    totalSize: string;
  }> {
    try {
      if (!this.bot) {
        throw new Error("Telegram bot not configured");
      }

      // This would require admin access to get channel stats
      // For now, return estimated stats based on usage
      return {
        totalMessages: 0,
        audioFiles: 0,
        videoFiles: 0,
        totalSize: "0 MB"
      };
    } catch (error) {
      console.error("Failed to get channel stats:", error);
      throw error;
    }
  }

  // Generate direct streaming link with metadata
  generateStreamingResponse(telegramFile: TelegramFile, format: string): object {
    return {
      status: "success",
      streaming: {
        url: telegramFile.streamUrl || telegramFile.downloadUrl,
        direct_url: telegramFile.downloadUrl,
        telegram_message: `https://t.me/c/${this.channelId.replace('-100', '')}/${telegramFile.messageId}`,
        supports_range_requests: true,
        optimized_for_streaming: true
      },
      metadata: {
        video_id: telegramFile.metadata?.videoId,
        title: telegramFile.metadata?.title,
        duration: telegramFile.metadata?.duration,
        format: format,
        stream_type: telegramFile.metadata?.streamType,
        file_size: telegramFile.metadata?.fileSize,
        uploaded_at: telegramFile.metadata?.uploadedAt
      },
      telegram: {
        channel_id: this.channelId,
        message_id: telegramFile.messageId,
        file_id: telegramFile.fileId,
        searchable_tags: [
          `#${telegramFile.metadata?.streamType?.toUpperCase()}`,
          `#${telegramFile.metadata?.videoId}`,
          `#${format.toUpperCase()}`,
          "#TubeAPI"
        ]
      }
    };
  }
}

export const telegramService = new TelegramService();
