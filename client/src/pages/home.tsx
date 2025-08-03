import Hero from "@/components/hero";
import Features from "@/components/features";
import PricingSection from "@/components/pricing-section";
import ApiDocs from "@/components/api-docs";
import Footer from "@/components/footer";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Hero />
      <Features />
      <PricingSection />
      <ApiDocs />
      <Footer />
    </div>
  );
}
