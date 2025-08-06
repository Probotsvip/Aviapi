# YouTube Downloader API Project

## Overview
This is a full-stack JavaScript application that provides a YouTube downloader API service with Telegram integration. The project has been successfully migrated from Replit Agent to the standard Replit environment.

## Project Architecture

### Backend (Node.js/Express)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with JWT
- **External Services**: 
  - Telegram Bot integration
  - YouTube download capabilities
  - Stripe payment processing

### Frontend (React/Vite)
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Radix UI + Tailwind CSS
- **Build Tool**: Vite

### Database Schema
The application includes comprehensive tables for:
- Users with roles and subscription management
- API keys with usage tracking and limits
- Download history and status tracking
- Usage statistics and analytics
- Admin logging and system metrics

## Key Features
- User registration and authentication
- API key management with rate limiting
- YouTube video/audio download functionality
- Telegram bot integration for streaming
- Admin dashboard capabilities
- Stripe subscription management
- Usage analytics and monitoring

## Migration Status
- ✅ Database connection configured for Replit PostgreSQL
- ✅ Dependencies installed and verified
- ✅ Application successfully running on port 5000
- ✅ Database schema deployed

## Recent Changes
- **2025-01-06**: Migrated database connection from Neon to standard PostgreSQL for Replit compatibility
- **2025-01-06**: Fixed ES module imports for pg package
- **2025-01-06**: Successfully deployed database schema using Drizzle
- **2025-01-06**: **MAJOR UPDATE**: Integrated third-party YouTube API service from JerryCoder - completely replaced yt-dlp and cookies approach with direct download URLs. No more YouTube cookies needed!
- **2025-08-06**: **PERFORMANCE ENHANCEMENT**: Modified system to return direct CDN URLs from third-party API instead of downloading and re-uploading files. This eliminates file processing time and provides instant access to content via third-party CDN URLs (e.g., cdn402.savetube.su). Response time reduced from 8+ seconds to ~2.7 seconds for new downloads.

## User Preferences
- Keep security practices robust with proper client/server separation
- Maintain comprehensive error handling and logging
- Follow modern full-stack JavaScript patterns

## Technical Notes
- Application runs on `npm run dev` which starts both Express server and Vite frontend
- Database operations use Drizzle ORM with TypeScript
- All environment variables properly configured including DATABASE_URL