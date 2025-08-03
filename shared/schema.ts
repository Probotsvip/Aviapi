import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan").default("free"), // free, starter, pro, enterprise
  role: text("role").default("user"), // user, admin, super_admin
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0),
  usageLimit: integer("usage_limit").default(1000), // monthly limit
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const downloads = pgTable("downloads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id),
  youtubeId: text("youtube_id").notNull(),
  title: text("title"),
  format: text("format"), // mp3, mp4, webm, m4a
  telegramMessageId: text("telegram_message_id"),
  telegramFileId: text("telegram_file_id"),
  fileSize: integer("file_size"),
  duration: text("duration"),
  status: text("status").default("processing"), // processing, completed, failed
  downloadUrl: text("download_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const usageStats = pgTable("usage_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id),
  endpoint: text("endpoint"), // /song, /video
  responseTime: integer("response_time"), // in milliseconds
  statusCode: integer("status_code"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const adminLogs = pgTable("admin_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  action: text("action").notNull(), // user_created, user_deleted, api_key_revoked, etc.
  targetType: text("target_type"), // user, api_key, download, system
  targetId: text("target_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemMetrics = pgTable("system_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricType: text("metric_type").notNull(), // storage_usage, bandwidth, api_calls, etc.
  value: integer("value").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  downloads: many(downloads),
  usageStats: many(usageStats),
  adminLogs: many(adminLogs),
}));

export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
  downloads: many(downloads),
  usageStats: many(usageStats),
}));

export const downloadsRelations = relations(downloads, ({ one }) => ({
  user: one(users, { fields: [downloads.userId], references: [users.id] }),
  apiKey: one(apiKeys, { fields: [downloads.apiKeyId], references: [apiKeys.id] }),
}));

export const usageStatsRelations = relations(usageStats, ({ one }) => ({
  user: one(users, { fields: [usageStats.userId], references: [users.id] }),
  apiKey: one(apiKeys, { fields: [usageStats.apiKeyId], references: [apiKeys.id] }),
}));

export const adminLogsRelations = relations(adminLogs, ({ one }) => ({
  admin: one(users, { fields: [adminLogs.adminId], references: [users.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
});

export const insertApiKeySchema = createInsertSchema(apiKeys).pick({
  name: true,
  usageLimit: true,
});

export const insertDownloadSchema = createInsertSchema(downloads).pick({
  youtubeId: true,
  format: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type Download = typeof downloads.$inferSelect;
export type InsertDownload = z.infer<typeof insertDownloadSchema>;
export type UsageStats = typeof usageStats.$inferSelect;
export type AdminLog = typeof adminLogs.$inferSelect;
export type SystemMetric = typeof systemMetrics.$inferSelect;
