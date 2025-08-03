# Overview

TubeAPI is a YouTube content download API service that provides developers with endpoints to download audio and video from YouTube. The application uses Telegram as a storage backend, eliminating the need for traditional file storage infrastructure. It features user authentication, API key management, usage analytics, subscription billing through Stripe, and comprehensive rate limiting.

## Current Status (August 2025)
- ✅ Complete user authentication and API key management system
- ✅ Telegram bot integration working (Bot: 7412125068:AAE_xef9Tgq0MZXpknz3-WPPKK7hl6t3im0, Channel: -1002863131570)
- ✅ Professional frontend with pricing plans and dashboard
- ✅ Database schema with PostgreSQL/Neon integration
- ✅ Real YouTube downloading with yt-dlp (up to 1GB, maximum quality)
- ✅ Production-ready system migrated to Replit
- ✅ Comprehensive admin panel with advanced features
- ✅ API testing interface with default admin API key (10k daily requests)
- ✅ Real-time response monitoring and detailed background analytics
- ✅ User's existing API integration with external download services
- ✅ Cookie-based fallback system for YouTube downloads
- ✅ Telegram channel storage for downloaded files and streaming
- ✅ Enhanced API key management with automatic expiry and daily limits
- ⏳ Stripe payment integration (temporarily disabled for demo)

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for client-side routing
- **Forms**: React Hook Form with Zod validation

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with JWT-based authentication
- **Middleware**: Custom authentication, rate limiting, and error handling
- **File Processing**: YouTube content download using yt-dlp and ytdl-core

## Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM for type-safe database operations
- **File Storage**: Telegram channels for storing downloaded content
- **Session Management**: JWT tokens stored in localStorage

## Authentication and Authorization
- **User Authentication**: JWT tokens with bcrypt password hashing
- **API Authentication**: API key-based authentication for external developers
- **Admin Access Control**: Role-based authentication for admin panel access
- **Authorization Levels**: User-based and API key-based rate limiting
- **Session Persistence**: Client-side token storage with automatic header injection
- **Admin Testing**: Special admin API key with 10k daily request limit for testing

## Database Schema Design
- **Users Table**: Stores user accounts with role-based access and Stripe integration
- **API Keys Table**: Manages developer API keys with usage tracking and limits
- **Downloads Table**: Tracks download history and metadata with status tracking
- **Usage Stats Table**: Enhanced analytics with IP, user-agent, and error tracking
- **Admin Logs Table**: Comprehensive admin action logging for audit trails
- **System Metrics Table**: Real-time system performance and health monitoring

## Rate Limiting Strategy
- **API Key Limits**: 10 requests per minute per API key
- **User Limits**: 5 requests per minute per authenticated user
- **Implementation**: In-memory Maps with time-window reset logic

## Content Processing Pipeline
- **Video Information**: YouTube metadata extraction using ytdl-core
- **Audio Extraction**: yt-dlp for high-quality audio conversion
- **File Upload**: Automated upload to Telegram channels for CDN delivery
- **Download Tracking**: Complete audit trail from request to delivery

# External Dependencies

## Payment Processing
- **Stripe**: Subscription billing and payment processing
- **Integration**: Customer creation, subscription management, and checkout flows

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting
- **Connection**: WebSocket-based connection pooling for optimal performance

## Content Delivery
- **Telegram Bot API**: File storage and delivery through Telegram channels (ACTIVE)
- **Bot Token**: 7412125068:AAE_xef9Tgq0MZXpknz3-WPPKK7hl6t3im0
- **Channel ID**: -1002863131570
- **Benefits**: Global CDN, unlimited storage, and reliable delivery infrastructure
- **Status**: Successfully tested, real file uploads working

## YouTube Integration
- **yt-dlp**: Primary tool for video/audio extraction and conversion
- **ytdl-core**: Backup solution for metadata extraction and basic downloads
- **Supported Formats**: MP3, M4A, WebM for audio; MP4, WebM for video

## Admin Panel Features
- **Dashboard**: Real-time metrics, system health, and recent activity monitoring
- **User Management**: Role-based user control with plan and status management
- **API Key Management**: Monitor usage, revoke keys, and track performance
- **Advanced Analytics**: Charts, usage patterns, and performance insights
- **API Testing Interface**: Built-in API testing with default admin key (10k requests)
- **Response Monitoring**: Detailed background response analysis and debugging
- **System Logs**: Comprehensive admin action tracking and audit trails

## Development Tools
- **Vite**: Fast development server and build tool with HMR
- **ESBuild**: Production bundling for server-side code
- **TypeScript**: Type safety across the entire application stack