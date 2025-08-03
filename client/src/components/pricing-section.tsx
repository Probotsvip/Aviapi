import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Star } from "lucide-react";
import { Link } from "wouter";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 9,
    calls: "10,000",
    features: [
      "10,000 API calls/month",
      "Audio downloads (MP3)",
      "Basic API documentation",
      "Email support",
      "99.5% uptime SLA"
    ],
    popular: false
  },
  {
    id: "pro",
    name: "Pro",
    price: 29,
    calls: "100,000",
    features: [
      "100,000 API calls/month",
      "Audio & Video downloads",
      "Multiple quality options",
      "Priority support",
      "Usage analytics",
      "99.9% uptime SLA"
    ],
    popular: true
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 99,
    calls: "1,000,000",
    features: [
      "1,000,000 API calls/month",
      "All formats supported",
      "Custom integration help",
      "24/7 dedicated support",
      "Advanced analytics",
      "99.95% uptime SLA",
      "Custom rate limits"
    ],
    popular: false
  }
];

export default function PricingSection() {
  return (
    <section className="py-20 px-4 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose the plan that fits your needs. All plans include our core features with no hidden fees.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card key={plan.id} className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-primary text-white px-4 py-1 rounded-full text-sm font-medium flex items-center">
                    <Star className="h-4 w-4 mr-1" />
                    Most Popular
                  </div>
                </div>
              )}
              
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <p className="text-gray-600 mt-2">{plan.calls} API calls</p>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link href={`/checkout?plan=${plan.id}`}>
                  <Button 
                    className={`w-full ${plan.popular ? 'bg-primary hover:bg-primary/90' : ''}`} 
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    Get Started
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-600">
            Need something custom? <Link href="/contact" className="text-primary hover:underline">Contact us</Link> for enterprise solutions.
          </p>
        </div>
      </div>
    </section>
  );
}