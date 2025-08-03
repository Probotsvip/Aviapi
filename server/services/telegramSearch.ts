import fetch from 'node-fetch';

interface TelegramConfig {
  botToken: string;
  channelId: string;
}

interface TelegramMessage {
  message_id: number;
  text?: string;
  caption?: string;
  audio?: {
    file_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
    duration?: number;
  };
  video?: {
    file_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
    duration?: number;
    width?: number;
    height?: number;
  };
  document?: {
    file_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
}

interface SearchResult {
  file_id: string;
  file_type: 'audio' | 'video';
  title: string;
  file_size?: number;
  duration?: number;
  message_id: number;
  download_url?: string;
}

export class TelegramSearchService {
  private config: TelegramConfig;

  constructor(config: TelegramConfig) {
    this.config = config;
  }

  updateConfig(newConfig: Partial<TelegramConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔄 Telegram config updated:', newConfig);
  }

  // Find existing file by video ID and format (MAIN SEARCH FUNCTION)
  async findExistingFile(videoId: string, format: 'mp3' | 'mp4'): Promise<SearchResult | null> {
    console.log(`🔍 Searching Telegram channel for: ${videoId}.${format}`);
    
    try {
      // Use getUpdates to search recent messages
      const messages = await this.searchRecentMessages(videoId);
      
      for (const message of messages) {
        const result = this.parseMessageForVideoId(message, videoId, format);
        if (result) {
          // Get fresh download URL using current bot token
          const downloadUrl = await this.getFileDownloadUrl(result.file_id);
          if (downloadUrl) {
            result.download_url = downloadUrl;
            console.log(`✅ Found existing file: ${result.title} (${format})`);
            return result;
          }
        }
      }
      
      console.log(`❌ No existing file found for ${videoId}.${format}`);
      return null;
      
    } catch (error) {
      console.error('❌ Telegram search error:', error);
      return null;
    }
  }

  // Search recent channel messages using getUpdates
  private async searchRecentMessages(videoId: string, limit: number = 100): Promise<TelegramMessage[]> {
    const url = `https://api.telegram.org/bot${this.config.botToken}/getUpdates`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: limit,
          allowed_updates: ['channel_post']
        })
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      if (!data.ok) {
        throw new Error(`Telegram API error: ${data.description}`);
      }

      // Filter and return channel posts that might contain our video
      return data.result
        .filter((update: any) => update.channel_post)
        .map((update: any) => update.channel_post)
        .filter((message: TelegramMessage) => {
          const text = message.text || message.caption || '';
          return text.toLowerCase().includes(videoId.toLowerCase());
        })
        .reverse(); // Recent messages first

    } catch (error) {
      console.error('❌ Error searching Telegram messages:', error);
      return [];
    }
  }

  // Parse message to find video content
  private parseMessageForVideoId(message: TelegramMessage, videoId: string, format: 'mp3' | 'mp4'): SearchResult | null {
    const text = message.text || message.caption || '';
    
    // Check if message contains our video ID
    if (!text.toLowerCase().includes(videoId.toLowerCase())) {
      return null;
    }

    // Check for audio file (mp3)
    if (format === 'mp3' && message.audio) {
      return {
        file_id: message.audio.file_id,
        file_type: 'audio',
        title: text,
        file_size: message.audio.file_size,
        duration: message.audio.duration,
        message_id: message.message_id
      };
    }

    // Check for video file (mp4)
    if (format === 'mp4' && message.video) {
      return {
        file_id: message.video.file_id,
        file_type: 'video',
        title: text,
        file_size: message.video.file_size,
        duration: message.video.duration,
        message_id: message.message_id
      };
    }

    // Check for document with correct mime type
    if (message.document) {
      const mimeType = message.document.mime_type || '';
      const isAudio = mimeType.includes('audio') || mimeType.includes('mp3');
      const isVideo = mimeType.includes('video') || mimeType.includes('mp4');
      
      if ((format === 'mp3' && isAudio) || (format === 'mp4' && isVideo)) {
        return {
          file_id: message.document.file_id,
          file_type: format === 'mp3' ? 'audio' : 'video',
          title: text,
          file_size: message.document.file_size,
          message_id: message.message_id
        };
      }
    }

    return null;
  }

  // Get fresh download URL from file_id (INDEPENDENT OF BOT TOKEN CHANGES)
  async getFileDownloadUrl(fileId: string): Promise<string | null> {
    try {
      console.log(`📥 Getting download URL for file_id: ${fileId.substring(0, 20)}...`);
      
      const fileInfoUrl = `https://api.telegram.org/bot${this.config.botToken}/getFile`;
      const response = await fetch(fileInfoUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId })
      });

      if (!response.ok) {
        throw new Error(`Telegram getFile API error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      if (!data.ok) {
        throw new Error(`Telegram getFile error: ${data.description}`);
      }

      const filePath = data.result.file_path;
      if (!filePath) {
        throw new Error('No file path returned from Telegram');
      }

      // Generate download URL with current bot token
      const downloadUrl = `https://api.telegram.org/file/bot${this.config.botToken}/${filePath}`;
      console.log(`✅ Generated fresh download URL with current token`);
      
      return downloadUrl;

    } catch (error) {
      console.error(`❌ Error getting download URL for file_id:`, error);
      return null;
    }
  }
}

// Singleton service
let telegramSearchInstance: TelegramSearchService | null = null;

export function getTelegramSearchService(): TelegramSearchService {
  if (!telegramSearchInstance) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '7412125068:AAE_xef9Tgq0MZXpknz3-WPPKK7hl6t3im0';
    const channelId = process.env.TELEGRAM_CHANNEL_ID || '-1002863131570';
    
    telegramSearchInstance = new TelegramSearchService({
      botToken,
      channelId
    });
  }
  
  return telegramSearchInstance;
}

// Update configuration (for config.py changes)
export function updateTelegramConfig(newConfig: Partial<TelegramConfig>): void {
  const service = getTelegramSearchService();
  service.updateConfig(newConfig);
}