# Telegram Channel Search Guide

## 🔍 How to Search in Telegram Channel

### Method 1: Direct Telegram Search
1. Open your Telegram channel: https://t.me/c/2863131570 (remove -100 prefix)
2. Use Telegram's built-in search with these hashtags:

**Search by Content Type:**
- `#AUDIO` - Find all audio files
- `#VIDEO` - Find all video files  
- `#MP3` - Find all MP3 audio files
- `#MP4` - Find all MP4 video files

**Search by Video ID:**
- `#dQw4w9WgXcQ` - Find specific video by YouTube ID
- `#Qq4j1LtCdww` - Find another specific video

**Search by Keywords:**
- `#TubeAPI` - Find all TubeAPI uploads
- `#StreamReady` - Find all streaming-ready files
- `#YouTubeAudio` - Find all YouTube audio downloads
- `#YouTubeVideo` - Find all YouTube video downloads

### Method 2: API Search Endpoints

**Search API:**
```bash
curl "http://localhost:5000/api/search?query=Rick&api=YOUR_API_KEY"
curl "http://localhost:5000/api/search?query=dQw4w9WgXcQ&type=audio&api=YOUR_API_KEY"
```

**Metadata API:**
```bash
curl "http://localhost:5000/api/metadata/dQw4w9WgXcQ?api=YOUR_API_KEY"
```

### Method 3: File Organization in Channel

Each uploaded file has rich metadata:

```
🎵 Song Title Here

📱 #AUDIO #MP3 #dQw4w9WgXcQ
🎬 Video ID: dQw4w9WgXcQ
⏱️ Duration: 3:33
📊 Size: 6.1 MB
🔗 Stream Type: Audio
📅 Uploaded: 2025-08-03

#TubeAPI #YouTubeAudio #StreamReady
```

## 🎯 Search Examples

1. **Find all Rick Astley songs:**
   - Telegram: Search `Rick Astley`
   - API: `/api/search?query=Rick`

2. **Find specific video:**
   - Telegram: Search `#dQw4w9WgXcQ`
   - API: `/api/metadata/dQw4w9WgXcQ`

3. **Find all audio files:**
   - Telegram: Search `#AUDIO`
   - API: `/api/search?type=audio`

4. **Find all video files:**
   - Telegram: Search `#VIDEO`
   - API: `/api/search?type=video`

## 🔗 Direct Streaming

All files support direct streaming:
- Click any file in Telegram to stream immediately
- Use API streaming URLs for external players
- Files are optimized for buffering and playback

## 📊 Channel Statistics

Use the metadata API to see:
- All available formats for a video
- File sizes and upload dates
- Direct Telegram and streaming URLs
- Searchable hashtags for each file