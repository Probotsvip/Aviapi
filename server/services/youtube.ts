import fetch from "node-fetch";
import { Buffer } from "buffer";

// Add type for hex property
interface YoutuberClass {
  hex: string;
}

// Third-party YouTube API service (JerryCoder)
class Youtubers {
  private hex: string;

  constructor() {
    this.hex = "C5D58EF67A7584E4A29F6C35BBC4EB12";
  }

  async uint8(hex: string) {
    const pecahan = hex.match(/[\dA-F]{2}/gi);
    if (!pecahan) throw new Error("Format tidak valid");
    return new Uint8Array(pecahan.map(h => parseInt(h, 16)));
  }

  b64Byte(b64: string) {
    const bersih = b64.replace(/\s/g, "");
    const biner = Buffer.from(bersih, 'base64');
    return new Uint8Array(biner);
  }

  async key() {
    const raw = await this.uint8(this.hex);
    return await crypto.subtle.importKey("raw", raw, { name: "AES-CBC" }, false, ["decrypt"]);
  }

  async Data(base64Terenkripsi: string) {
    const byteData = this.b64Byte(base64Terenkripsi);
    if (byteData.length < 16) throw new Error("Data terlalu pendek");

    const iv = byteData.slice(0, 16);
    const data = byteData.slice(16);

    const kunci = await this.key();
    const hasil = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, kunci, data);

    const teks = new TextDecoder().decode(new Uint8Array(hasil));
    return JSON.parse(teks);
  }

  async getCDN() {
    let retries = 5;
    while (retries--) {
      try {
        const res = await fetch("https://media.savetube.me/api/random-cdn");
        const data = await res.json() as any;
        if (data?.cdn) return data.cdn;
      } catch {}
    }
    throw new Error("Gagal ambil CDN setelah 5 percobaan");
  }

  async infoVideo(linkYoutube: string) {
    const cdn = await this.getCDN();
    const res = await fetch(`https://${cdn}/v2/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: linkYoutube }),
    });

    const hasil = await res.json() as any;
    if (!hasil.status) throw new Error(hasil.message || "Gagal ambil data video");

    const isi = await this.Data(hasil.data);
    return {
      judul: isi.title,
      durasi: isi.durationLabel,
      thumbnail: isi.thumbnail,
      kode: isi.key
    };
  }

  async getDownloadLink(kodeVideo: string, kualitas: string, downloadType: 'video' | 'audio' = 'video') {
    let retries = 5;
    while (retries--) {
      try {
        const cdn = await this.getCDN();
        const res = await fetch(`https://${cdn}/download`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            downloadType: downloadType,
            quality: kualitas,
            key: kodeVideo,
          }),
        });

        const json = await res.json() as any;
        if (json?.status && json?.data?.downloadUrl) {
          return json.data.downloadUrl;
        }
      } catch {}
    }
    throw new Error("Gagal ambil link unduh setelah 5 percobaan");
  }

  async downloadVideo(linkYoutube: string, kualitas: string = '360') {
    try {
      const data = await this.infoVideo(linkYoutube);
      const linkUnduh = await this.getDownloadLink(data.kode, kualitas, 'video');
      return {
        status: true,
        judul: data.judul,
        durasi: data.durasi,
        thumbnail: data.thumbnail,
        url: linkUnduh,
      };
    } catch (err: any) {
      return {
        status: false,
        pesan: err.message
      };
    }
  }

  async downloadAudio(linkYoutube: string) {
    try {
      const data = await this.infoVideo(linkYoutube);
      const linkUnduh = await this.getDownloadLink(data.kode, '128', 'audio');
      return {
        status: true,
        judul: data.judul,
        durasi: data.durasi,
        thumbnail: data.thumbnail,
        url: linkUnduh,
      };
    } catch (err: any) {
      return {
        status: false,
        pesan: err.message
      };
    }
  }
}

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
  private youtubers: Youtubers;

  constructor() {
    this.youtubers = new Youtubers();
  }

  private extractVideoId(url: string): string {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    if (!match) {
      throw new Error("Invalid YouTube URL");
    }
    return match[1];
  }

  async getVideoInfo(videoId: string): Promise<VideoInfo | null> {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const info = await this.youtubers.infoVideo(url);
      
      return {
        title: this.sanitizeTitle(info.judul || `Video_${videoId}`),
        duration: info.durasi || "Unknown",
        thumbnail: info.thumbnail || "",
        videoId
      };
    } catch (error) {
      console.error("Failed to get video info:", error);
      return null;
    }
  }

  async downloadSongViaAPI(videoId: string): Promise<DownloadResult> {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      console.log(`Downloading audio for video ${videoId} via third-party API`);
      
      const result = await this.youtubers.downloadAudio(url);
      
      if (!result.status) {
        throw new Error(result.pesan || "Audio download failed");
      }

      return {
        buffer: undefined,
        isDirect: false,
        filePath: result.url // Direct download URL from third-party API
      };
    } catch (error) {
      console.error("API audio download failed:", error);
      return { isDirect: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async downloadVideoViaAPI(videoId: string, quality: string = "360"): Promise<DownloadResult> {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      console.log(`Downloading video for ${videoId} via third-party API with quality ${quality}`);
      
      const result = await this.youtubers.downloadVideo(url, quality);
      
      if (!result.status) {
        throw new Error(result.pesan || "Video download failed");
      }

      return {
        buffer: undefined,
        isDirect: false,
        filePath: result.url // Direct download URL from third-party API
      };
    } catch (error) {
      console.error("API video download failed:", error);
      return { isDirect: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async downloadAudio(videoId: string): Promise<Buffer | null> {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      console.log(`Direct audio download for video ${videoId}`);
      
      const result = await this.youtubers.downloadAudio(url);
      
      if (!result.status) {
        throw new Error(result.pesan || "Audio download failed");
      }

      // Download the file from the URL
      const response = await fetch(result.url);
      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.statusText}`);
      }

      const buffer = await response.buffer();
      console.log(`Audio download completed: ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      console.error("Failed to download audio:", error);
      return null;
    }
  }

  async downloadVideo(videoId: string, quality: string = "360"): Promise<Buffer | null> {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      console.log(`Direct video download for ${videoId} with quality ${quality}`);
      
      const result = await this.youtubers.downloadVideo(url, quality);
      
      if (!result.status) {
        throw new Error(result.pesan || "Video download failed");
      }

      // Download the file from the URL
      const response = await fetch(result.url);
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
      }

      const buffer = await response.buffer();
      console.log(`Video download completed: ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      console.error("Failed to download video:", error);
      return null;
    }
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
