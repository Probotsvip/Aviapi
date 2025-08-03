import ytdl from "ytdl-core";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

interface VideoInfo {
  title: string;
  duration: string;
  thumbnail: string;
}

class YouTubeService {
  async getVideoInfo(videoId: string): Promise<VideoInfo | null> {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const info = await ytdl.getInfo(url);
      
      const duration = this.formatDuration(parseInt(info.videoDetails.lengthSeconds));
      
      return {
        title: info.videoDetails.title,
        duration,
        thumbnail: info.videoDetails.thumbnails[0]?.url || ""
      };
    } catch (error) {
      console.error("Failed to get video info:", error);
      return null;
    }
  }

  async downloadAudio(videoId: string): Promise<Buffer | null> {
    try {
      // For demo purposes, create a small dummy audio buffer
      // In production, this would use yt-dlp to download actual audio
      console.log(`Demo: Downloading audio for video ${videoId}`);
      
      // Create a small dummy buffer to simulate audio file
      const dummyAudio = Buffer.from("dummy-audio-data-for-demo-purposes");
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return dummyAudio;
    } catch (error) {
      console.error("Failed to download audio:", error);
      return null;
    }
  }

  async downloadVideo(videoId: string, quality: string = "720p"): Promise<Buffer | null> {
    try {
      // For demo purposes, create a small dummy video buffer
      // In production, this would use yt-dlp to download actual video
      console.log(`Demo: Downloading video for ${videoId} at ${quality}`);
      
      // Create a small dummy buffer to simulate video file
      const dummyVideo = Buffer.from("dummy-video-data-for-demo-purposes");
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return dummyVideo;
    } catch (error) {
      console.error("Failed to download video:", error);
      return null;
    }
  }

  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

export const youtubeService = new YouTubeService();
