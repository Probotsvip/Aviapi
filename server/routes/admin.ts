import type { Express } from "express";
import { eq, desc, sql, and, gte, count, sum } from "drizzle-orm";
import { storage } from "../storage";
import { authenticateUser } from "../middleware/auth";
import { users, apiKeys, downloads, usageStats, adminLogs, systemMetrics } from "@shared/schema";
import { db } from "../db";

// Admin middleware to check admin role
async function requireAdmin(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (req.user.role !== "admin" && req.user.role !== "super_admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  next();
}

// Log admin actions
async function logAdminAction(adminId: string, action: string, targetType?: string, targetId?: string, details?: any, ipAddress?: string) {
  try {
    await db.insert(adminLogs).values({
      adminId,
      action,
      targetType: targetType || null,
      targetId: targetId || null,
      details: details || null,
      ipAddress: ipAddress || null,
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
}

export function registerAdminRoutes(app: Express) {
  
  // Dashboard Overview
  app.get("/api/admin/dashboard", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const today = new Date();
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get summary statistics
      const [
        totalUsers,
        totalApiKeys,
        totalDownloads,
        weeklyDownloads,
        monthlyRevenue,
        systemHealth
      ] = await Promise.all([
        db.select({ count: count() }).from(users),
        db.select({ count: count() }).from(apiKeys).where(eq(apiKeys.isActive, true)),
        db.select({ count: count() }).from(downloads),
        db.select({ count: count() }).from(downloads).where(gte(downloads.createdAt, lastWeek)),
        db.select({ count: count() }).from(users).where(and(eq(users.isActive, true), sql`plan != 'free'`)),
        db.select({ 
          successful: count(),
          total: sql<number>`count(*) filter (where status_code = 200) + count(*) filter (where status_code != 200)`
        }).from(usageStats).where(gte(usageStats.createdAt, lastWeek))
      ]);

      // Recent activity
      const recentActivity = await db
        .select({
          id: downloads.id,
          title: downloads.title,
          format: downloads.format,
          status: downloads.status,
          userName: users.username,
          createdAt: downloads.createdAt
        })
        .from(downloads)
        .leftJoin(users, eq(downloads.userId, users.id))
        .orderBy(desc(downloads.createdAt))
        .limit(10);

      // System metrics
      const errorRate = await db
        .select({
          errors: sql<number>`count(*) filter (where status_code >= 400)`,
          total: count()
        })
        .from(usageStats)
        .where(gte(usageStats.createdAt, lastWeek));

      const avgResponseTime = await db
        .select({
          avg: sql<number>`avg(response_time)`
        })
        .from(usageStats)
        .where(and(
          gte(usageStats.createdAt, lastWeek),
          sql`response_time is not null`
        ));

      res.json({
        summary: {
          totalUsers: totalUsers[0]?.count || 0,
          totalApiKeys: totalApiKeys[0]?.count || 0,
          totalDownloads: totalDownloads[0]?.count || 0,
          weeklyDownloads: weeklyDownloads[0]?.count || 0,
          monthlyRevenue: monthlyRevenue[0]?.count || 0,
          systemUptime: Math.floor(process.uptime() / 3600) // hours
        },
        metrics: {
          errorRate: errorRate[0] ? (errorRate[0].errors / errorRate[0].total * 100).toFixed(2) : "0",
          avgResponseTime: Math.round(avgResponseTime[0]?.avg || 0),
          successRate: systemHealth[0] ? (systemHealth[0].successful / (systemHealth[0].total || 1) * 100).toFixed(1) : "100"
        },
        recentActivity: recentActivity.map(activity => ({
          id: activity.id,
          title: activity.title || "Unknown",
          format: activity.format,
          status: activity.status,
          user: activity.userName || "System",
          timestamp: activity.createdAt
        }))
      });

    } catch (error: any) {
      console.error("Admin dashboard error:", error);
      res.status(500).json({ message: "Failed to load dashboard" });
    }
  });

  // User Management
  app.get("/api/admin/users", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string;
      const offset = (page - 1) * limit;

      let query = db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        plan: users.plan,
        role: users.role,
        isActive: users.isActive,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
        apiKeyCount: sql<number>`(select count(*) from ${apiKeys} where user_id = ${users.id})`,
        downloadCount: sql<number>`(select count(*) from ${downloads} where user_id = ${users.id})`
      }).from(users);

      if (search) {
        query = query.where(sql`${users.username} ilike ${'%' + search + '%'} or ${users.email} ilike ${'%' + search + '%'}`);
      }

      const usersList = await query
        .orderBy(desc(users.createdAt))
        .offset(offset)
        .limit(limit);

      const totalCount = await db.select({ count: count() }).from(users);

      res.json({
        users: usersList,
        pagination: {
          page,
          limit,
          total: totalCount[0]?.count || 0,
          pages: Math.ceil((totalCount[0]?.count || 0) / limit)
        }
      });

    } catch (error: any) {
      console.error("Users list error:", error);
      res.status(500).json({ message: "Failed to load users" });
    }
  });

  // User Details
  app.get("/api/admin/users/:id", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const [userApiKeys, userDownloads, userStats] = await Promise.all([
        db.select().from(apiKeys).where(eq(apiKeys.userId, userId)),
        db.select().from(downloads).where(eq(downloads.userId, userId)).orderBy(desc(downloads.createdAt)).limit(10),
        db.select({
          endpoint: usageStats.endpoint,
          count: count(),
          avgResponseTime: sql<number>`avg(response_time)`
        })
        .from(usageStats)
        .where(eq(usageStats.userId, userId))
        .groupBy(usageStats.endpoint)
      ]);

      res.json({
        user: {
          ...user,
          password: undefined // Never return password
        },
        apiKeys: userApiKeys,
        recentDownloads: userDownloads,
        usageStats: userStats
      });

    } catch (error: any) {
      console.error("User details error:", error);
      res.status(500).json({ message: "Failed to load user details" });
    }
  });

  // Update User
  app.patch("/api/admin/users/:id", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const { plan, role, isActive } = req.body;
      
      const [updatedUser] = await db
        .update(users)
        .set({
          plan: plan || undefined,
          role: role || undefined,
          isActive: isActive !== undefined ? isActive : undefined
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      await logAdminAction(
        req.user!.id,
        "user_updated",
        "user",
        userId,
        { plan, role, isActive },
        req.ip
      );

      res.json({
        user: {
          ...updatedUser,
          password: undefined
        }
      });

    } catch (error: any) {
      console.error("User update error:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // System Analytics
  app.get("/api/admin/analytics", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Downloads over time
      const downloadsOverTime = await db
        .select({
          date: sql<string>`date_trunc('day', created_at)`,
          count: count(),
          successful: sql<number>`count(*) filter (where status = 'completed')`
        })
        .from(downloads)
        .where(gte(downloads.createdAt, since))
        .groupBy(sql`date_trunc('day', created_at)`)
        .orderBy(sql`date_trunc('day', created_at)`);

      // API usage by endpoint
      const endpointUsage = await db
        .select({
          endpoint: usageStats.endpoint,
          count: count(),
          avgResponseTime: sql<number>`avg(response_time)`,
          errorRate: sql<number>`count(*) filter (where status_code >= 400) * 100.0 / count(*)`
        })
        .from(usageStats)
        .where(gte(usageStats.createdAt, since))
        .groupBy(usageStats.endpoint);

      // Popular formats
      const formatStats = await db
        .select({
          format: downloads.format,
          count: count()
        })
        .from(downloads)
        .where(gte(downloads.createdAt, since))
        .groupBy(downloads.format)
        .orderBy(desc(count()));

      // Top users by usage
      const topUsers = await db
        .select({
          username: users.username,
          email: users.email,
          plan: users.plan,
          downloadCount: count(downloads.id),
          totalSize: sql<number>`sum(coalesce(file_size, 0))`
        })
        .from(users)
        .leftJoin(downloads, eq(users.id, downloads.userId))
        .where(gte(downloads.createdAt, since))
        .groupBy(users.id, users.username, users.email, users.plan)
        .orderBy(desc(count(downloads.id)))
        .limit(10);

      res.json({
        downloadsOverTime,
        endpointUsage,
        formatStats,
        topUsers
      });

    } catch (error: any) {
      console.error("Analytics error:", error);
      res.status(500).json({ message: "Failed to load analytics" });
    }
  });

  // System Logs
  app.get("/api/admin/logs", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      const logs = await db
        .select({
          id: adminLogs.id,
          action: adminLogs.action,
          targetType: adminLogs.targetType,
          targetId: adminLogs.targetId,
          details: adminLogs.details,
          adminName: users.username,
          createdAt: adminLogs.createdAt
        })
        .from(adminLogs)
        .leftJoin(users, eq(adminLogs.adminId, users.id))
        .orderBy(desc(adminLogs.createdAt))
        .offset(offset)
        .limit(limit);

      res.json({ logs });

    } catch (error: any) {
      console.error("Logs error:", error);
      res.status(500).json({ message: "Failed to load logs" });
    }
  });

  // API Key Management
  app.get("/api/admin/api-keys", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const apiKeysList = await db
        .select({
          id: apiKeys.id,
          key: apiKeys.key,
          name: apiKeys.name,
          isActive: apiKeys.isActive,
          usageCount: apiKeys.usageCount,
          usageLimit: apiKeys.usageLimit,
          dailyLimit: apiKeys.dailyLimit,
          dailyUsage: apiKeys.dailyUsage,
          lastResetDate: apiKeys.lastResetDate,
          expiresAt: apiKeys.expiresAt,
          lastUsed: apiKeys.lastUsed,
          createdAt: apiKeys.createdAt,
          userName: users.username,
          userEmail: users.email
        })
        .from(apiKeys)
        .leftJoin(users, eq(apiKeys.userId, users.id))
        .orderBy(desc(apiKeys.createdAt))
        .offset(offset)
        .limit(limit);

      res.json({ apiKeys: apiKeysList });

    } catch (error: any) {
      console.error("API keys error:", error);
      res.status(500).json({ message: "Failed to load API keys" });
    }
  });

  // Create API Key for User
  app.post("/api/admin/api-keys", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const { userId, name, usageLimit, dailyLimit, expiresAt } = req.body;
      
      if (!userId || !name) {
        return res.status(400).json({ message: "User ID and name are required" });
      }

      // Check if user exists
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate unique API key
      const apiKey = `sk_${Date.now()}_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

      // Set default expiry (30 days from now) if not provided
      const defaultExpiry = new Date();
      defaultExpiry.setDate(defaultExpiry.getDate() + 30);

      const [newApiKey] = await db
        .insert(apiKeys)
        .values({
          userId,
          key: apiKey,
          name,
          usageLimit: usageLimit || 1000,
          dailyLimit: dailyLimit || 100,
          expiresAt: expiresAt ? new Date(expiresAt) : defaultExpiry,
          isActive: true
        })
        .returning();

      await logAdminAction(
        req.user!.id,
        "api_key_created",
        "api_key",
        newApiKey.id,
        { 
          forUser: user.username,
          name,
          usageLimit: usageLimit || 1000,
          dailyLimit: dailyLimit || 100,
          expiresAt: expiresAt || defaultExpiry.toISOString()
        },
        req.ip
      );

      res.json({ 
        apiKey: {
          ...newApiKey,
          userName: user.username,
          userEmail: user.email
        },
        message: "API key created successfully"
      });

    } catch (error: any) {
      console.error("API key creation error:", error);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });

  // Revoke API Key
  app.delete("/api/admin/api-keys/:id", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const keyId = req.params.id;
      
      await db
        .update(apiKeys)
        .set({ isActive: false })
        .where(eq(apiKeys.id, keyId));

      await logAdminAction(
        req.user!.id,
        "api_key_revoked",
        "api_key",
        keyId,
        null,
        req.ip
      );

      res.json({ message: "API key revoked successfully" });

    } catch (error: any) {
      console.error("API key revoke error:", error);
      res.status(500).json({ message: "Failed to revoke API key" });
    }
  });

  // API Testing - Get default admin API key
  app.get("/api/admin/test-api-key", authenticateUser, requireAdmin, async (req, res) => {
    try {
      // Check if admin test key exists
      let [adminKey] = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.name, "Admin Test Key"), eq(apiKeys.isActive, true)));

      // Create admin test key if it doesn't exist
      if (!adminKey) {
        const testKey = `admin_test_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        [adminKey] = await db
          .insert(apiKeys)
          .values({
            userId: req.user!.id,
            key: testKey,
            name: "Admin Test Key",
            usageLimit: 10000,
            dailyLimit: 10000, // 10k daily requests
            usageCount: 0,
            dailyUsage: 0,
            isActive: true,
          })
          .returning();

        await logAdminAction(
          req.user!.id,
          "admin_test_key_created",
          "api_key",
          adminKey.id,
          { usageLimit: 10000 },
          req.ip
        );
      }

      res.json({ 
        apiKey: adminKey.key,
        usageCount: adminKey.usageCount,
        usageLimit: adminKey.usageLimit,
        resetDaily: true
      });

    } catch (error: any) {
      console.error("Admin test key error:", error);
      res.status(500).json({ message: "Failed to get admin test key" });
    }
  });

  // API Testing - Test endpoint with detailed response
  app.post("/api/admin/test-endpoint", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const { endpoint, youtubeUrl, format, apiKey } = req.body;
      
      if (!endpoint || !youtubeUrl || !apiKey) {
        return res.status(400).json({ 
          message: "Missing required fields: endpoint, youtubeUrl, apiKey" 
        });
      }

      const startTime = Date.now();
      let testResult: any = {};

      try {
        // Make internal API call to test the endpoint
        const baseUrl = `http://localhost:5000`;
        const testUrl = `${baseUrl}${endpoint}?url=${encodeURIComponent(youtubeUrl)}&format=${format || 'mp3'}&api=${apiKey}`;
        
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(testUrl);
        const responseTime = Date.now() - startTime;
        
        let responseData;
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        testResult = {
          success: response.ok,
          statusCode: response.status,
          responseTime,
          headers: Object.fromEntries(response.headers.entries()),
          data: responseData,
          url: testUrl,
          timestamp: new Date().toISOString()
        };

        // Log the admin API test
        await logAdminAction(
          req.user!.id,
          "api_endpoint_tested",
          "system",
          endpoint,
          {
            youtubeUrl,
            format,
            statusCode: response.status,
            responseTime,
            success: response.ok
          },
          req.ip
        );

      } catch (testError: any) {
        const responseTime = Date.now() - startTime;
        
        testResult = {
          success: false,
          error: testError.message,
          responseTime,
          timestamp: new Date().toISOString(),
          url: `${endpoint}?url=${encodeURIComponent(youtubeUrl)}&format=${format || 'mp3'}&api=${apiKey}`
        };

        await logAdminAction(
          req.user!.id,
          "api_endpoint_test_failed",
          "system",
          endpoint,
          {
            youtubeUrl,
            format,
            error: testError.message,
            responseTime
          },
          req.ip
        );
      }

      res.json(testResult);

    } catch (error: any) {
      console.error("API test error:", error);
      res.status(500).json({ message: "Failed to test API endpoint" });
    }
  });

  // Reset admin test key usage (daily reset)
  app.post("/api/admin/reset-test-key", authenticateUser, requireAdmin, async (req, res) => {
    try {
      await db
        .update(apiKeys)
        .set({ usageCount: 0 })
        .where(and(eq(apiKeys.name, "Admin Test Key"), eq(apiKeys.isActive, true)));

      await logAdminAction(
        req.user!.id,
        "admin_test_key_reset",
        "api_key",
        "admin_test_key",
        null,
        req.ip
      );

      res.json({ message: "Admin test key usage reset successfully" });

    } catch (error: any) {
      console.error("Test key reset error:", error);
      res.status(500).json({ message: "Failed to reset test key" });
    }
  });

}