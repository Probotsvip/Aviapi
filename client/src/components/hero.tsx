import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Play, Download, Code, Zap } from "lucide-react";

export default function Hero() {
  return (
    <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-indigo-50 via-white to-pink-50">
      <div className="max-w-7xl mx-auto text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            YouTube Download API
            <span className="text-primary block">Made Simple</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Professional YouTube content downloading API with instant delivery. 
            Download audio and video files directly to your application through our reliable REST API.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/register">
              <Button size="lg" className="text-lg px-8 py-3">
                <Zap className="mr-2 h-5 w-5" />
                Start Free Trial
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="outline" size="lg" className="text-lg px-8 py-3">
                <Code className="mr-2 h-5 w-5" />
                View API Docs
              </Button>
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="text-center">
              <div className="bg-white rounded-lg p-6 shadow-sm border">
                <Download className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Instant Downloads</h3>
                <p className="text-gray-600">
                  Get YouTube content in seconds with our optimized download infrastructure
                </p>
              </div>
            </div>
            
            <div className="text-center">
              <div className="bg-white rounded-lg p-6 shadow-sm border">
                <Play className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Multiple Formats</h3>
                <p className="text-gray-600">
                  Support for MP3, MP4, and other popular audio/video formats
                </p>
              </div>
            </div>
            
            <div className="text-center">
              <div className="bg-white rounded-lg p-6 shadow-sm border">
                <Code className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Developer Friendly</h3>
                <p className="text-gray-600">
                  Simple REST API with comprehensive documentation and examples
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}