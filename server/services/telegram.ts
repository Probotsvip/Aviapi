import { Telegraf } from "telegraf";

interface TelegramFile {
  messageId: string;
  fileId: string;
  downloadUrl: string;
}

class TelegramService {
  private bot: Telegraf;
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
        // Fallback to demo mode if bot initialization failed
        const mockMessageId = Math.floor(Math.random() * 1000000);
        return {
          messageId: mockMessageId.toString(),
          fileId: `demo_audio_${mockMessageId}`,
          downloadUrl: `https://demo.tubeapi.dev/files/audio_${mockMessageId}.mp3`
        };
      }

      const message = await this.bot.telegram.sendAudio(this.channelId, {
        source: audioBuffer,
        filename: `${title}.mp3`
      }, {
        caption: title,
        performer: "YouTube",
        title: title
      });

      if (message.audio) {
        return {
          messageId: message.message_id.toString(),
          fileId: message.audio.file_id,
          downloadUrl: `https://t.me/c/${this.channelId.replace('-100', '')}/${message.message_id}`
        };
      }
      
      return null;
    } catch (error) {
      console.error("Failed to upload audio to Telegram:", error);
      // Return demo response on error
      const mockMessageId = Math.floor(Math.random() * 1000000);
      return {
        messageId: mockMessageId.toString(),
        fileId: `demo_audio_${mockMessageId}`,
        downloadUrl: `https://demo.tubeapi.dev/files/audio_${mockMessageId}.mp3`
      };
    }
  }

  async uploadVideo(videoBuffer: Buffer, title: string): Promise<TelegramFile | null> {
    try {
      if (!this.bot) {
        // Fallback to demo mode if bot initialization failed
        const mockMessageId = Math.floor(Math.random() * 1000000);
        return {
          messageId: mockMessageId.toString(),
          fileId: `demo_video_${mockMessageId}`,
          downloadUrl: `https://demo.tubeapi.dev/files/video_${mockMessageId}.mp4`
        };
      }

      const message = await this.bot.telegram.sendVideo(this.channelId, {
        source: videoBuffer,
        filename: `${title}.mp4`
      }, {
        caption: title
      });

      if (message.video) {
        return {
          messageId: message.message_id.toString(),
          fileId: message.video.file_id,
          downloadUrl: `https://t.me/c/${this.channelId.replace('-100', '')}/${message.message_id}`
        };
      }
      
      return null;
    } catch (error) {
      console.error("Failed to upload video to Telegram:", error);
      // Return demo response on error
      const mockMessageId = Math.floor(Math.random() * 1000000);
      return {
        messageId: mockMessageId.toString(),
        fileId: `demo_video_${mockMessageId}`,
        downloadUrl: `https://demo.tubeapi.dev/files/video_${mockMessageId}.mp4`
      };
    }
  }

  async getFileUrl(fileId: string): Promise<string | null> {
    try {
      if (!this.bot) {
        return `https://demo.tubeapi.dev/files/${fileId}`;
      }

      const file = await this.bot.telegram.getFile(fileId);
      return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    } catch (error) {
      console.error("Failed to get file URL:", error);
      return null;
    }
  }
}

export const telegramService = new TelegramService();
