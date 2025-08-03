import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  Users, 
  Key, 
  Download, 
  BarChart3, 
  Shield, 
  Settings, 
  Activity,
  TrendingUp,
  Clock,
  Database,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Ban,
  UserCheck,
  FileText,
  Calendar,
  Filter,
  Search,
  RefreshCw,
  Crown
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
// import { Progress } from "@/components/ui/progress";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AdminStats {
  summary: {
    totalUsers: number;
    totalApiKeys: number;
    totalDownloads: number;
    weeklyDownloads: number;
    monthlyRevenue: number;
    systemUptime: number;
  };
  metrics: {
    errorRate: string;
    avgResponseTime: number;
    successRate: string;
  };
  recentActivity: Array<{
    id: string;
    title: string;
    format: string;
    status: string;
    user: string;
    timestamp: string;
  }>;
}

interface User {
  id: string;
  username: string;
  email: string;
  plan: string;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  apiKeyCount: number;
  downloadCount: number;
}

interface ApiKey {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  usageCount: number;
  usageLimit: number;
  lastUsed: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
}

interface ApiTestResult {
  success: boolean;
  statusCode?: number;
  responseTime: number;
  headers?: Record<string, string>;
  data?: any;
  error?: string;
  url: string;
  timestamp: string;
}

export default function AdminPanel() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userPage, setUserPage] = useState(1);
  const [testUrl, setTestUrl] = useState("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const [testFormat, setTestFormat] = useState("mp3");
  const [testEndpoint, setTestEndpoint] = useState("/api/song");
  const [testResult, setTestResult] = useState<ApiTestResult | null>(null);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dashboard stats query
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/dashboard"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Users query
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users", userPage, searchQuery],
    queryFn: () => apiRequest(`/api/admin/users?page=${userPage}&search=${searchQuery}`),
  });

  // API Keys query
  const { data: apiKeysData } = useQuery({
    queryKey: ["/api/admin/api-keys"],
  });

  // Analytics query
  const { data: analytics } = useQuery({
    queryKey: ["/api/admin/analytics"],
    queryFn: () => apiRequest("/api/admin/analytics?days=30"),
  });

  // Admin test API key query
  const { data: testApiKey } = useQuery({
    queryKey: ["/api/admin/test-api-key"],
    queryFn: () => apiRequest("/api/admin/test-api-key"),
  });

  // User update mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: any }) =>
      apiRequest(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated successfully" });
      setSelectedUser(null);
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

  // API Key revoke mutation
  const revokeApiKeyMutation = useMutation({
    mutationFn: (keyId: string) =>
      apiRequest(`/api/admin/api-keys/${keyId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      toast({ title: "API key revoked successfully" });
    },
    onError: () => {
      toast({ title: "Failed to revoke API key", variant: "destructive" });
    },
  });

  // Test API endpoint
  const testApiEndpoint = async () => {
    if (!testApiKey?.apiKey) {
      toast({ title: "No test API key available", variant: "destructive" });
      return;
    }

    setIsTestLoading(true);
    try {
      const result = await apiRequest("/api/admin/test-endpoint", {
        method: "POST",
        body: JSON.stringify({
          endpoint: testEndpoint,
          youtubeUrl: testUrl,
          format: testFormat,
          apiKey: testApiKey.apiKey,
        }),
      });

      setTestResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/test-api-key"] });
      toast({ title: "API test completed" });
    } catch (error) {
      toast({ title: "API test failed", variant: "destructive" });
    } finally {
      setIsTestLoading(false);
    }
  };

  // Reset test key usage
  const resetTestKeyMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/reset-test-key", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/test-api-key"] });
      toast({ title: "Test key usage reset successfully" });
    },
    onError: () => {
      toast({ title: "Failed to reset test key", variant: "destructive" });
    },
  });

  const StatCard = ({ title, value, description, icon: Icon, trend }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <div className={`text-xs flex items-center mt-1 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className="h-3 w-3 mr-1" />
            {trend > 0 ? '+' : ''}{trend}% from last week
          </div>
        )}
      </CardContent>
    </Card>
  );

  const UserDialog = () => (
    <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            User Management - {selectedUser?.username}
          </DialogTitle>
          <DialogDescription>
            Manage user permissions, plan, and account status
          </DialogDescription>
        </DialogHeader>
        
        {selectedUser && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan">Plan</Label>
                <Select
                  value={selectedUser.plan}
                  onValueChange={(value) => setSelectedUser({...selectedUser, plan: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={selectedUser.role}
                  onValueChange={(value) => setSelectedUser({...selectedUser, role: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={selectedUser.isActive}
                onChange={(e) => setSelectedUser({...selectedUser, isActive: e.target.checked})}
                className="w-4 h-4"
              />
              <Label htmlFor="isActive">Account Active</Label>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Email:</strong> {selectedUser.email}
              </div>
              <div>
                <strong>Created:</strong> {new Date(selectedUser.createdAt).toLocaleDateString()}
              </div>
              <div>
                <strong>API Keys:</strong> {selectedUser.apiKeyCount}
              </div>
              <div>
                <strong>Downloads:</strong> {selectedUser.downloadCount}
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setSelectedUser(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => updateUserMutation.mutate({
                  userId: selectedUser.id,
                  data: {
                    plan: selectedUser.plan,
                    role: selectedUser.role,
                    isActive: selectedUser.isActive
                  }
                })}
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending ? "Updating..." : "Update User"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Crown className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">TubeAPI Admin Panel</h1>
                <p className="text-muted-foreground">Advanced system management and analytics</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                System Healthy
              </Badge>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="downloads" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Downloads
            </TabsTrigger>
            <TabsTrigger value="api-test" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              API Test
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              System
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {statsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-full"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard
                    title="Total Users"
                    value={stats?.summary.totalUsers || 0}
                    description="Registered users"
                    icon={Users}
                  />
                  <StatCard
                    title="Active API Keys"
                    value={stats?.summary.totalApiKeys || 0}
                    description="Currently active"
                    icon={Key}
                  />
                  <StatCard
                    title="Total Downloads"
                    value={stats?.summary.totalDownloads || 0}
                    description="All time downloads"
                    icon={Download}
                  />
                  <StatCard
                    title="Weekly Downloads"
                    value={stats?.summary.weeklyDownloads || 0}
                    description="Last 7 days"
                    icon={Calendar}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard
                    title="Success Rate"
                    value={`${stats?.metrics.successRate || 100}%`}
                    description="Last 7 days"
                    icon={CheckCircle}
                  />
                  <StatCard
                    title="Avg Response Time"
                    value={`${stats?.metrics.avgResponseTime || 0}ms`}
                    description="System performance"
                    icon={Clock}
                  />
                  <StatCard
                    title="System Uptime"
                    value={`${stats?.summary.systemUptime || 0}h`}
                    description="Current session"
                    icon={Activity}
                  />
                </div>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats?.recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Badge variant={activity.status === 'completed' ? 'default' : 'secondary'}>
                              {activity.format}
                            </Badge>
                            <div>
                              <p className="font-medium">{activity.title}</p>
                              <p className="text-sm text-muted-foreground">by {activity.user}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={activity.status === 'completed' ? 'default' : 'destructive'}>
                              {activity.status}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(activity.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">User Management</h2>
                <p className="text-muted-foreground">Manage user accounts, permissions, and plans</p>
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64"
                />
                <Button variant="outline">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>API Keys</TableHead>
                      <TableHead>Downloads</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersData?.users?.map((user: User) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.username}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.plan === 'free' ? 'secondary' : 'default'}>
                            {user.plan}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'destructive' : 'outline'}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? 'default' : 'destructive'}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.apiKeyCount}</TableCell>
                        <TableCell>{user.downloadCount}</TableCell>
                        <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedUser(user)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">API Key Management</h2>
              <p className="text-muted-foreground">Monitor and manage API keys across the system</p>
            </div>

            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key Name</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeysData?.apiKeys?.map((key: ApiKey) => (
                      <TableRow key={key.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{key.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {key.key.substring(0, 16)}...
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{key.userName}</p>
                            <p className="text-sm text-muted-foreground">{key.userEmail}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all"
                                style={{ width: `${Math.min((key.usageCount / key.usageLimit) * 100, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {key.usageCount}/{key.usageLimit}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={key.isActive ? 'default' : 'destructive'}>
                            {key.isActive ? 'Active' : 'Revoked'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}
                        </TableCell>
                        <TableCell>{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {key.isActive && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => revokeApiKeyMutation.mutate(key.id)}
                              disabled={revokeApiKeyMutation.isPending}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">System Analytics</h2>
              <p className="text-muted-foreground">Comprehensive insights and performance metrics</p>
            </div>

            {analytics && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Downloads Over Time */}
                <Card>
                  <CardHeader>
                    <CardTitle>Downloads Over Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={analytics.downloadsOverTime}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="count" stroke="#8884d8" fill="#8884d8" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Format Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Popular Formats</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analytics.formatStats}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                          label={({ format, percent }) => `${format} ${(percent * 100).toFixed(0)}%`}
                        >
                          {analytics.formatStats.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={`hsl(${index * 137.5}, 70%, 50%)`} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* API Endpoint Usage */}
                <Card>
                  <CardHeader>
                    <CardTitle>API Endpoint Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.endpointUsage}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="endpoint" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#8884d8" />
                        <Bar dataKey="avgResponseTime" fill="#82ca9d" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Top Users */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Users by Usage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analytics.topUsers.slice(0, 10).map((user: any, index: number) => (
                        <div key={user.username} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Badge variant="outline">{index + 1}</Badge>
                            <div>
                              <p className="font-medium">{user.username}</p>
                              <p className="text-sm text-muted-foreground">{user.plan}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{user.downloadCount} downloads</p>
                            <p className="text-sm text-muted-foreground">
                              {(user.totalSize / 1024 / 1024).toFixed(1)} MB
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* API Test Tab */}
          <TabsContent value="api-test" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">API Server Testing</h2>
              <p className="text-muted-foreground">Test API endpoints with admin credentials and view detailed responses</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Test Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Test Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {testApiKey && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium">Admin Test API Key</Label>
                        <Badge variant="outline">10k Daily Limit</Badge>
                      </div>
                      <p className="text-xs font-mono bg-background p-2 rounded border">
                        {testApiKey.apiKey}
                      </p>
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span>Usage: {testApiKey.usageCount}/{testApiKey.usageLimit}</span>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => resetTestKeyMutation.mutate()}
                          disabled={resetTestKeyMutation.isPending}
                        >
                          Reset Usage
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="endpoint">API Endpoint</Label>
                      <Select value={testEndpoint} onValueChange={setTestEndpoint}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="/api/song">Audio Download - /api/song</SelectItem>
                          <SelectItem value="/api/video">Video Download - /api/video</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="url">YouTube URL</Label>
                      <Input
                        id="url"
                        value={testUrl}
                        onChange={(e) => setTestUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                    </div>

                    <div>
                      <Label htmlFor="format">Format</Label>
                      <Select value={testFormat} onValueChange={setTestFormat}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mp3">MP3 (Audio)</SelectItem>
                          <SelectItem value="m4a">M4A (Audio)</SelectItem>
                          <SelectItem value="mp4">MP4 (Video)</SelectItem>
                          <SelectItem value="webm">WebM (Video)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button 
                      onClick={testApiEndpoint} 
                      disabled={isTestLoading || !testApiKey}
                      className="w-full"
                    >
                      {isTestLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Testing API...
                        </>
                      ) : (
                        <>
                          <Activity className="h-4 w-4 mr-2" />
                          Test API Endpoint
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Test Results */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Response Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {testResult ? (
                    <div className="space-y-4">
                      {/* Status Overview */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          {testResult.success ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span className="font-medium">
                            {testResult.success ? "Success" : "Failed"}
                          </span>
                        </div>
                        <div className="text-right text-sm">
                          <div>Status: {testResult.statusCode}</div>
                          <div className="text-muted-foreground">{testResult.responseTime}ms</div>
                        </div>
                      </div>

                      {/* Request URL */}
                      <div>
                        <Label className="text-sm font-medium">Request URL</Label>
                        <p className="text-xs font-mono bg-muted p-2 rounded mt-1 break-all">
                          {testResult.url}
                        </p>
                      </div>

                      {/* Response Headers */}
                      {testResult.headers && (
                        <div>
                          <Label className="text-sm font-medium">Response Headers</Label>
                          <div className="text-xs font-mono bg-muted p-2 rounded mt-1 max-h-40 overflow-auto">
                            {Object.entries(testResult.headers).map(([key, value]) => (
                              <div key={key} className="flex">
                                <span className="text-blue-600 mr-2">{key}:</span>
                                <span>{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Response Data */}
                      <div>
                        <Label className="text-sm font-medium">Response Data</Label>
                        <div className="text-xs font-mono bg-muted p-2 rounded mt-1 max-h-60 overflow-auto">
                          {testResult.error ? (
                            <div className="text-red-500">Error: {testResult.error}</div>
                          ) : (
                            <pre>{JSON.stringify(testResult.data, null, 2)}</pre>
                          )}
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="text-xs text-muted-foreground">
                        Tested at: {new Date(testResult.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Run an API test to see detailed response information</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Test Results Summary */}
            {testResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Quick Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-2xl font-bold">
                        {testResult.success ? "✓" : "✗"}
                      </div>
                      <div className="text-sm text-muted-foreground">Status</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-2xl font-bold">{testResult.statusCode}</div>
                      <div className="text-sm text-muted-foreground">HTTP Code</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-2xl font-bold">{testResult.responseTime}ms</div>
                      <div className="text-sm text-muted-foreground">Response Time</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-2xl font-bold">
                        {testResult.data ? Object.keys(testResult.data).length || "N/A" : "0"}
                      </div>
                      <div className="text-sm text-muted-foreground">Data Fields</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <UserDialog />
    </div>
  );
}