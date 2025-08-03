# Streaming Flow Logic - Same Query Multiple Times

## 🔄 Scenario: User Query "xyz" दो बार

### First Request: `/api/song/xyz?api=user_key`

#### Step 1: Database Check
```sql
SELECT * FROM downloads WHERE youtubeId = 'xyz' AND format = 'mp3' AND status = 'completed'
```
**Result:** No existing record found

#### Step 2: Video Info Extraction
- yt-dlp से YouTube metadata fetch करता है
- Title, duration, thumbnail extract करता है

#### Step 3: Download Process
- yt-dlp से high-quality audio download करता है
- File size: Usually 5-10 MB

#### Step 4: Telegram Upload
- File को Telegram channel में upload करता है
- Rich metadata के साथ caption add करता है
- Message ID और File ID मिलता है

#### Step 5: Database Storage
```sql
INSERT INTO downloads (youtubeId, format, title, telegramMessageId, telegramFileId, downloadUrl, status)
VALUES ('xyz', 'mp3', 'Song Title', '15', 'CQACAgUAAy...', 'https://api.telegram.org/file/...', 'completed')
```

#### Step 6: API Response
```json
{
  "status": "done",
  "title": "Song Title",
  "link": "https://api.telegram.org/file/bot.../music/file_X.mp3",
  "format": "mp3",
  "duration": "3:45"
}
```

**Total Time:** ~15-30 seconds (depending on file size)

---

### Second Request: `/api/song/xyz?api=user_key` (Same Query)

#### Step 1: Database Check
```sql
SELECT * FROM downloads WHERE youtubeId = 'xyz' AND format = 'mp3' AND status = 'completed'
```
**Result:** ✅ Record found!

#### Step 2: Instant Response (No Processing)
```json
{
  "status": "done",
  "title": "Song Title",
  "link": "https://api.telegram.org/file/bot.../music/file_X.mp3",
  "format": "mp3",
  "duration": "3:45"
}
```

**Total Time:** ~50-100ms (database query only)

---

## 📊 Performance Comparison

| Process | First Request | Second Request |
|---------|---------------|----------------|
| Database Query | ✅ | ✅ |
| YouTube Info | ✅ | ❌ |
| Download | ✅ | ❌ |
| Telegram Upload | ✅ | ❌ |
| Response Time | 15-30 seconds | 50-100ms |
| Bandwidth Used | 5-10 MB | ~1 KB |
| CPU Usage | High | Minimal |

---

## 🎯 Caching Logic Benefits

### Storage Efficiency
- **Same file not downloaded again**
- **Same bandwidth not wasted**
- **Telegram storage reused**

### Speed Benefits
- **300x faster response** (30s → 0.1s)
- **Instant streaming** available
- **No waiting time**

### Resource Optimization
- **CPU usage minimal**
- **Network calls reduced**
- **Server load decreased**

---

## 🔗 Telegram Channel Impact

### First Request:
- New message created in channel
- File uploaded with metadata
- Searchable hashtags added

### Second Request:
- **No new message created**
- **Same Telegram URL returned**
- **Existing file reused**

---

## 📈 Usage Analytics

Both requests logged separately:
```sql
-- First request
INSERT INTO usage_stats (userId, apiKeyId, endpoint, responseTime, statusCode)
VALUES ('user1', 'key1', '/song', 25000, 200)

-- Second request  
INSERT INTO usage_stats (userId, apiKeyId, endpoint, responseTime, statusCode)
VALUES ('user1', 'key1', '/song', 100, 200)
```

---

## 🎵 Live Example

### Request 1: `GET /api/song/dQw4w9WgXcQ`
```
Response Time: 25 seconds
Process: Download → Upload → Store → Response
Result: https://api.telegram.org/file/.../music/file_1.mp3
```

### Request 2: `GET /api/song/dQw4w9WgXcQ`
```
Response Time: 100ms
Process: Database lookup → Response  
Result: Same URL (https://api.telegram.org/file/.../music/file_1.mp3)
```

---

## 💡 Smart Caching Features

### Duplicate Detection
- **Video ID based caching**
- **Format specific storage**
- **Status validation**

### Consistency 
- **Same URL always returned**
- **No duplicate uploads**
- **Reliable streaming**

### Scalability
- **Multiple users can request same video**
- **All get same cached result**
- **Shared Telegram storage**