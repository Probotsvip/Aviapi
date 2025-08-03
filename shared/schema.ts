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
  isActive: boolean("is_active").default(true),
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
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  downloads: many(downloads),
  usageStats: many(usageStats),
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
