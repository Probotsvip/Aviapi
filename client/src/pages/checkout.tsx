import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getUser } from "@/lib/auth";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

const CheckoutForm = ({ plan }: { plan: string }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payment Successful",
        description: "Thank you for your purchase! Redirecting to dashboard...",
      });
      setTimeout(() => {
        setLocation("/dashboard");
      }, 2000);
    }
    
    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-primary hover:bg-indigo-700 py-3 text-lg"
      >
        {processing ? "Processing..." : `Subscribe to ${plan} Plan`}
      </Button>
    </form>
  );
};

export default function Checkout() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const user = getUser();

  const plan = params.plan as string;

  const planDetails = {
    starter: { name: "Starter", price: 9, calls: "1,000" },
    pro: { name: "Pro", price: 29, calls: "10,000" },
    enterprise: { name: "Enterprise", price: 99, calls: "100,000" }
  };

  const currentPlan = planDetails[plan as keyof typeof planDetails];

  useEffect(() => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to continue with your purchase.",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }

    if (!currentPlan) {
      toast({
        title: "Invalid Plan",
        description: "The selected plan is not available.",
        variant: "destructive",
      });
      setLocation("/pricing");
      return;
    }

    // Create PaymentIntent as soon as the page loads
    apiRequest("POST", "/api/create-payment-intent", { plan })
      .then((res) => res.json())
      .then((data) => {
        setClientSecret(data.clientSecret);
        setLoading(false);
      })
      .catch((error) => {
        toast({
          title: "Error",
          description: "Failed to initialize payment. Please try again.",
          variant: "destructive",
        });
        setLocation("/pricing");
      });
  }, [plan, user, setLocation, toast, currentPlan]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-pink-50 pt-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  if (!clientSecret || !currentPlan) {
    return null;
  }

  // Display demo message if Stripe is not configured
  if (!stripePromise) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 pt-20">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Demo Mode</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-gray-600">
                Payment system is not configured yet. This is a demo of the TubeAPI platform.
              </p>
              <p className="text-sm text-gray-500">
                Selected Plan: {currentPlan.name} - ${currentPlan.price}/month
              </p>
              <Button onClick={() => setLocation("/dashboard")} className="bg-primary">
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Make SURE to wrap the form in <Elements> which provides the stripe context.
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 pt-20">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Subscribe to {currentPlan.name} Plan
          </h1>
          <p className="text-gray-600">
            Complete your payment to start using TubeAPI
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Plan Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Plan Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">{currentPlan.name} Plan</span>
                <span className="text-2xl font-bold text-primary">
                  ${currentPlan.price}/month
                </span>
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">API Calls per month</span>
                  <span>{currentPlan.calls}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">All audio formats</span>
                  <span className="text-green-600">✓</span>
                </div>
                {(plan === "pro" || plan === "enterprise") && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Video formats</span>
                    <span className="text-green-600">✓</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">API Documentation</span>
                  <span className="text-green-600">✓</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Usage Analytics</span>
                  <span className={plan === "starter" ? "text-gray-400" : "text-green-600"}>
                    {plan === "starter" ? "✗" : "✓"}
                  </span>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>${currentPlan.price}/month</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm plan={currentPlan.name} />
              </Elements>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8 text-sm text-gray-500">
          <p>
            By subscribing, you agree to our Terms of Service and Privacy Policy.
            You can cancel your subscription at any time.
          </p>
        </div>
      </div>
    </div>
  );
}
