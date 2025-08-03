import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export default function ApiDocs() {
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Quick Start
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Get started with TubeAPI in minutes. Here's a simple example to download your first YouTube audio.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Code className="mr-2 h-5 w-5" />
                  Example Request
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST https://api.tubeapi.dev/download \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://youtube.com/watch?v=VIDEO_ID",
    "format": "mp3",
    "quality": "192k"
  }'`}
                </pre>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Response</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "success": true,
  "download_id": "dl_abc123",
  "title": "Song Title",
  "duration": 180,
  "file_url": "https://files.tubeapi.dev/abc123.mp3",
  "file_size": 4521000,
  "format": "mp3"
}`}
                </pre>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-900">
              Simple, Powerful API
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="bg-primary/10 rounded-lg p-2 mr-4">
                  <span className="font-bold text-primary">1</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Get your API key</h4>
                  <p className="text-gray-600">Sign up and generate your API key from the dashboard</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-primary/10 rounded-lg p-2 mr-4">
                  <span className="font-bold text-primary">2</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Make a request</h4>
                  <p className="text-gray-600">Send a POST request with the YouTube URL and format</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-primary/10 rounded-lg p-2 mr-4">
                  <span className="font-bold text-primary">3</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Get the file</h4>
                  <p className="text-gray-600">Receive the download URL instantly</p>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <Link href="/docs">
                <Button className="flex items-center">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Full Documentation
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline">
                  Try It Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}