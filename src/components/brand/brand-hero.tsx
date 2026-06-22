import Image from "next/image";
import Link from "next/link";
import { Camera, MapPin, Sparkles } from "lucide-react";

import { BRAND, BRAND_LINES } from "@/config/brand";
import { GALLERY_IMAGES } from "@/config/gallery";

export function BrandHero() {
  const heroImage = GALLERY_IMAGES[0];

  return (
    <section className="relative overflow-hidden border-b border-[#e7cdd5] bg-[linear-gradient(135deg,#fff9f7_0%,#f8eef1_50%,#ead4db_100%)]">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8 lg:py-12">
        <div className="flex flex-col justify-center">
          <Link href="/" aria-label="Về trang đặt lịch MOMENTME BOOTH" className="mb-6 block w-fit">
            <Image
              src={BRAND.logoPath}
              alt={`Logo ${BRAND.name}`}
              width={360}
              height={101}
              priority
              className="h-auto w-56 max-w-full sm:w-72"
              sizes="(max-width: 640px) 224px, 288px"
            />
          </Link>

          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#9c3f5d]">
              Photobooth studio
            </p>
            <div>
              <h1 className="text-3xl font-semibold uppercase tracking-[0.12em] text-[#2c1720] sm:text-4xl lg:text-5xl">
                {BRAND.name}
              </h1>
              <p className="mt-3 font-serif text-xl italic text-[#6b1837] sm:text-2xl">
                {BRAND.slogan}
              </p>
            </div>

            <div className="grid gap-3 text-sm font-medium text-[#735a64] sm:text-base">
              <p className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#9c3f5d]" aria-hidden />
                <span>{BRAND_LINES.address}</span>
              </p>
              <p className="flex gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#c89a5b]" aria-hidden />
                <span>{BRAND_LINES.openingHours}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="relative min-h-64 overflow-hidden rounded-[28px] border border-[#e7cdd5] bg-[#fff9f7]/80 p-3 shadow-[0_24px_70px_rgba(72,20,38,0.16)]">
          {heroImage ? (
            <Image
              src={heroImage.src}
              alt={heroImage.alt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 420px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-[22px] border border-dashed border-[#d9a7b5] bg-[#f8eef1] px-6 text-center text-[#6b1837]">
              <Camera className="mb-4 h-10 w-10" aria-hidden />
              <p className="font-serif text-2xl italic">{BRAND.slogan}</p>
              <p className="mt-3 text-sm font-medium text-[#735a64]">
                Chọn một khoảnh khắc dành riêng cho bạn tại {BRAND.name}.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
