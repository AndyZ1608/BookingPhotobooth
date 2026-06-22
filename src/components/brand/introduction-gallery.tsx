import Image from "next/image";

import { BRAND } from "@/config/brand";
import { GALLERY_IMAGES } from "@/config/gallery";

export function IntroductionGallery() {
  if (GALLERY_IMAGES.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#9c3f5d]">
          Gallery
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[#2c1720]">
          Một chút về MOMENTME
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[#735a64]">
          Những khung hình dịu mềm của {BRAND.name}.
        </p>
      </div>

      <div className="flex snap-x gap-4 overflow-x-auto pb-3 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
        {GALLERY_IMAGES.map((image) => (
          <figure
            key={image.src}
            className="min-w-[78%] snap-center overflow-hidden rounded-[24px] border border-[#e7cdd5] bg-[#fff9f7] shadow-[0_18px_50px_rgba(72,20,38,0.10)] transition hover:scale-[1.01] hover:shadow-[0_22px_60px_rgba(72,20,38,0.14)] sm:min-w-0"
          >
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes="(max-width: 640px) 78vw, (max-width: 1024px) 50vw, 33vw"
              className="aspect-[4/5] h-auto w-full object-cover"
            />
          </figure>
        ))}
      </div>
    </section>
  );
}
