import { Telegraf } from "telegraf";

interface TelegramFile {
  messageId: string;
  fileId: string;
  downloadUrl: string;
}

class TelegramService {
  private bot: Telegraf | null = null;
  private channelId: string;

  constructor() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || "7412125068:AAE_xef9Tgq0MZXpknz3-WPPKK7hl6t3im0";
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

  async uploadAudio(audioBuffer: Buffer, title: string): Promise<TelegramFile | null> {
    try {
      if (!this.bot) {
        throw new Error("Telegram bot not configured - please provide TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID");
      }

      // Ensure filename is safe
      const safeTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
      
      const message = await this.bot.telegram.sendAudio(this.channelId, {
        source: audioBuffer,
        filename: `${safeTitle}.mp3`
      }, {
        caption: `🎵 ${title}`,
        performer: "TubeAPI",
        title: title,
        duration: undefined // Let Telegram detect
      });

      if (message.audio) {
        const downloadUrl = await this.getDirectDownloadUrl(message.audio.file_id);
        return {
          messageId: message.message_id.toString(),
          fileId: message.audio.file_id,
          downloadUrl: downloadUrl || `https://t.me/c/${this.channelId.replace('-100', '')}/${message.message_id}`
        };
      }
      
      return null;
    } catch (error) {
      console.error("Failed to upload audio to Telegram:", error);
      throw error; // Don't return fake data - throw the real error
    }
  }

  async uploadVideo(videoBuffer: Buffer, title: string): Promise<TelegramFile | null> {
    try {
      if (!this.bot) {
        throw new Error("Telegram bot not configured - please provide TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID");
      }

      // Ensure filename is safe
      const safeTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
      
      const fileSizeMB = videoBuffer.length / (1024 * 1024);
      console.log(`Uploading video: ${safeTitle} (${fileSizeMB.toFixed(1)} MB)`);

      const message = await this.bot.telegram.sendVideo(this.channelId, {
        source: videoBuffer,
        filename: `${safeTitle}.mp4`
      }, {
        caption: `🎬 ${title}`,
        supports_streaming: true
      });

      if (message.video) {
        const downloadUrl = await this.getDirectDownloadUrl(message.video.file_id);
        return {
          messageId: message.message_id.toString(),
          fileId: message.video.file_id,
          downloadUrl: downloadUrl || `https://t.me/c/${this.channelId.replace('-100', '')}/${message.message_id}`
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
}

export const telegramService = new TelegramService();
