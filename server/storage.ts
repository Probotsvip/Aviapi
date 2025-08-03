import { users, apiKeys, downloads, usageStats, type User, type InsertUser, type ApiKey, type InsertApiKey, type Download, type InsertDownload, type UsageStats } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, like, or } from "drizzle-orm";
import { randomBytes } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, customerId: string, subscriptionId?: string): Promise<User>;
  updateUserPlan(userId: string, plan: string): Promise<User>;

  // API Key methods
  getApiKey(key: string): Promise<ApiKey | undefined>;
  getUserApiKeys(userId: string): Promise<ApiKey[]>;
  createApiKey(userId: string, apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKeyUsage(keyId: string): Promise<void>;
  deactivateApiKey(keyId: string): Promise<void>;

  // Download methods
  createDownload(download: InsertDownload & { userId?: string; apiKeyId?: string }): Promise<Download>;
  updateDownload(id: string, updates: Partial<Download>): Promise<Download>;
  getDownload(id: string): Promise<Download | undefined>;
  getUserDownloads(userId: string): Promise<Download[]>;
  getDownloadByYoutubeId(youtubeId: string, format: string): Promise<Download | undefined>;
  getDownloadsByYoutubeId(youtubeId: string): Promise<Download[]>;
  searchDownloads(query: string, type?: 'audio' | 'video'): Promise<Download[]>;

  // Usage stats methods
  createUsageStats(stats: Partial<Omit<UsageStats, "id" | "createdAt">> & { userId?: string; apiKeyId?: string; endpoint?: string; responseTime?: number; statusCode?: number }): Promise<UsageStats>;
  getUserUsageStats(userId: string, days?: number): Promise<UsageStats[]>;
  getApiKeyUsageStats(apiKeyId: string, days?: number): Promise<UsageStats[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, customerId: string, subscriptionId?: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId || undefined
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserPlan(userId: string, plan: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ plan })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getApiKey(key: string): Promise<ApiKey | undefined> {
    const [apiKey] = await db.select().from(apiKeys).where(and(eq(apiKeys.key, key), eq(apiKeys.isActive, true)));
    return apiKey || undefined;
  }

  async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    return db.select().from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
  }

  async createApiKey(userId: string, insertApiKey: InsertApiKey): Promise<ApiKey> {
    const key = this.generateApiKey();
    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        ...insertApiKey,
        userId,
        key,
      })
      .returning();
    return apiKey;
  }

  async updateApiKeyUsage(keyId: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ 
        usageCount: sql`${apiKeys.usageCount} + 1`,
        lastUsed: new Date()
      })
      .where(eq(apiKeys.id, keyId));
  }

  async deactivateApiKey(keyId: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(eq(apiKeys.id, keyId));
  }

  async createDownload(download: InsertDownload & { userId?: string; apiKeyId?: string }): Promise<Download> {
    const [newDownload] = await db.insert(downloads).values(download).returning();
    return newDownload;
  }

  async updateDownload(id: string, updates: Partial<Download>): Promise<Download> {
    const [download] = await db
      .update(downloads)
      .set(updates)
      .where(eq(downloads.id, id))
      .returning();
    return download;
  }

  async getDownload(id: string): Promise<Download | undefined> {
    const [download] = await db.select().from(downloads).where(eq(downloads.id, id));
    return download || undefined;
  }

  async getUserDownloads(userId: string): Promise<Download[]> {
    return db.select().from(downloads).where(eq(downloads.userId, userId)).orderBy(desc(downloads.createdAt));
  }

  async getDownloadByYoutubeId(youtubeId: string, format: string): Promise<Download | undefined> {
    const [download] = await db
      .select()
      .from(downloads)
      .where(and(
        eq(downloads.youtubeId, youtubeId),
        eq(downloads.format, format),
        eq(downloads.status, "completed")
      ));
    return download || undefined;
  }

  async getDownloadsByYoutubeId(youtubeId: string): Promise<Download[]> {
    return db
      .select()
      .from(downloads)
      .where(and(
        eq(downloads.youtubeId, youtubeId),
        eq(downloads.status, "completed")
      ))
      .orderBy(desc(downloads.createdAt));
  }

  async searchDownloads(query: string, type?: 'audio' | 'video'): Promise<Download[]> {
    let conditions = [
      eq(downloads.status, "completed"),
      or(
        like(downloads.title, `%${query}%`),
        like(downloads.youtubeId, `%${query}%`)
      )
    ];

    if (type) {
      const format = type === 'audio' ? 'mp3' : 'mp4';
      conditions.push(eq(downloads.format, format));
    }

    return db
      .select()
      .from(downloads)
      .where(and(...conditions))
      .orderBy(desc(downloads.createdAt))
      .limit(50);
  }

  async createUsageStats(stats: Partial<Omit<UsageStats, "id" | "createdAt">> & { userId?: string; apiKeyId?: string; endpoint?: string; responseTime?: number; statusCode?: number }): Promise<UsageStats> {
    const [usageStatsRecord] = await db.insert(usageStats).values({
      userId: stats.userId || null,
      apiKeyId: stats.apiKeyId || null,
      endpoint: stats.endpoint || null,
      responseTime: stats.responseTime || null,
      statusCode: stats.statusCode || null,
      ipAddress: stats.ipAddress || null,
      userAgent: stats.userAgent || null,
      errorMessage: stats.errorMessage || null,
    }).returning();
    return usageStatsRecord;
  }

  async getUserUsageStats(userId: string, days: number = 30): Promise<UsageStats[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    return db
      .select()
      .from(usageStats)
      .where(and(
        eq(usageStats.userId, userId),
        sql`${usageStats.createdAt} >= ${since}`
      ))
      .orderBy(desc(usageStats.createdAt));
  }

  async getApiKeyUsageStats(apiKeyId: string, days: number = 30): Promise<UsageStats[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    return db
      .select()
      .from(usageStats)
      .where(and(
        eq(usageStats.apiKeyId, apiKeyId),
        sql`${usageStats.createdAt} >= ${since}`
      ))
      .orderBy(desc(usageStats.createdAt));
  }

  private generateApiKey(): string {
    const prefix = randomBytes(3).toString('hex');
    const suffix = randomBytes(16).toString('base64').replace(/[+/=]/g, '');
    return `${prefix}_${suffix}`;
  }
}

export const storage = new DatabaseStorage();
