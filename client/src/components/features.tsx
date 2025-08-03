import { CheckCircle, Shield, Zap, Globe, Code, BarChart } from "lucide-react";

const features = [
  {
    icon: CheckCircle,
    title: "High Quality Downloads",
    description: "Get the best available quality for both audio and video files with automatic format optimization."
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Optimized infrastructure ensures quick processing and delivery of your download requests."
  },
  {
    icon: Shield,
    title: "Reliable & Secure",
    description: "99.9% uptime with secure API authentication and encrypted file transfers."
  },
  {
    icon: Globe,
    title: "Global CDN",
    description: "Files are delivered through our global content delivery network for maximum speed."
  },
  {
    icon: Code,
    title: "Easy Integration",
    description: "Simple REST API with SDKs for popular programming languages and comprehensive docs."
  },
  {
    icon: BarChart,
    title: "Usage Analytics",
    description: "Track your API usage, monitor performance, and get detailed analytics in real-time."
  }
];

export default function Features() {
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Why Choose TubeAPI?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Built for developers who need reliable, fast, and scalable YouTube content downloading capabilities.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="text-center p-6">
              <div className="bg-primary/10 rounded-lg w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <feature.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}