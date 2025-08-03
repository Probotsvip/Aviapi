import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Plus, Trash2, Activity, Key, TrendingUp, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken, getUser, clearAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [newKeyName, setNewKeyName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = getUser();

  useEffect(() => {
    if (!getAuthToken()) {
      setLocation("/login");
    }
  }, [setLocation]);

  const { data: apiKeys, isLoading: keysLoading } = useQuery({
    queryKey: ["/api/keys"],
    enabled: !!user,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    enabled: !!user,
  });

  // Default stats for TypeScript
  const statsData = stats || {
    totalRequests: 0,
    successRate: "0%",
    avgResponseTime: "0ms",
    creditsLeft: 1000,
    recentActivity: []
  };

  const createKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/keys", {
        name,
        usageLimit: 1000,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      setNewKeyName("");
      toast({
        title: "API Key Created",
        description: "Your new API key has been generated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await apiRequest("DELETE", `/api/keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      toast({
        title: "API Key Deactivated",
        description: "The API key has been deactivated.",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "API key copied to clipboard.",
    });
  };

  const handleLogout = () => {
    clearAuth();
    setLocation("/");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-gray-900 text-white p-6 rounded-xl mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold mb-2">
                Welcome back, {user.username}!
              </h1>
              <p className="text-gray-300">
                Here's your API overview for this month
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-accent">
                {statsData.creditsLeft}
              </div>
              <div className="text-gray-300">Credits Left</div>
            </div>
            <Button 
              onClick={handleLogout}
              variant="outline"
              className="text-white border-white hover:bg-white hover:text-gray-900"
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-primary to-indigo-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100">Total Requests</p>
                  <p className="text-2xl font-bold">
                    {statsLoading ? "..." : statsData.totalRequests}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-indigo-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-accent to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100">Success Rate</p>
                  <p className="text-2xl font-bold">
                    {statsLoading ? "..." : statsData.successRate}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-secondary to-pink-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-pink-100">Avg Response</p>
                  <p className="text-2xl font-bold">
                    {statsLoading ? "..." : statsData.avgResponseTime}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-pink-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100">Credits Left</p>
                  <p className="text-2xl font-bold">
                    {statsLoading ? "..." : statsData.creditsLeft}
                  </p>
                </div>
                <Key className="h-8 w-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* API Keys and Recent Activity */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* API Keys */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="h-5 w-5" />
                <span>Your API Keys</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Create New Key */}
              <div className="space-y-3">
                <Label htmlFor="keyName">Create New API Key</Label>
                <div className="flex space-x-2">
                  <Input
                    id="keyName"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Key name (e.g., Production, Development)"
                  />
                  <Button
                    onClick={() => createKeyMutation.mutate(newKeyName)}
                    disabled={!newKeyName.trim() || createKeyMutation.isPending}
                    className="bg-primary hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Existing Keys */}
              <div className="space-y-4">
                {keysLoading ? (
                  <p className="text-gray-500">Loading API keys...</p>
                ) : !apiKeys || apiKeys.length === 0 ? (
                  <p className="text-gray-500">No API keys yet. Create your first one above!</p>
                ) : (
                  apiKeys.map((key: any) => (
                    <div key={key.id} className="bg-gray-50 p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{key.name}</span>
                        <div className="flex items-center space-x-2">
                          <Badge variant={key.isActive ? "default" : "secondary"}>
                            {key.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteKeyMutation.mutate(key.id)}
                            disabled={deleteKeyMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono flex-1 truncate">
                          {key.key}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(key.key)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Usage: {key.usageCount}/{key.usageLimit} requests
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Recent Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {statsLoading ? (
                  <p className="text-gray-500">Loading activity...</p>
                ) : statsData.recentActivity.length === 0 ? (
                  <p className="text-gray-500">No recent activity</p>
                ) : (
                  statsData.recentActivity.map((activity: any, index: number) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-white rounded-lg border">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.statusCode === 200 ? "bg-green-500" :
                        activity.statusCode === 202 ? "bg-yellow-500" : "bg-red-500"
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.endpoint === "/song" ? "Audio download" : "Video download"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge 
                        variant={activity.statusCode === 200 ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {activity.statusCode}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
