import { BrandFooter } from "@/components/brand/brand-footer";
import { BrandHero } from "@/components/brand/brand-hero";
import { IntroductionGallery } from "@/components/brand/introduction-gallery";
import { BookingForm } from "@/components/booking/booking-form";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#fff9f7] text-[#2c1720]">
      <BrandHero />
      <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <BookingForm />
      </section>
      <IntroductionGallery />
      <BrandFooter />
    </main>
  );
}
