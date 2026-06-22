import { BRAND, BRAND_LINES } from "@/config/brand";

export function BrandFooter() {
  return (
    <footer className="border-t border-[#e7cdd5] bg-[#481426] px-4 py-8 text-[#fff9f7]">
      <div className="mx-auto w-full max-w-6xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.28em]">{BRAND.name}</p>
        <p className="mt-2 font-serif text-lg italic text-[#f1d9df]">{BRAND.slogan}</p>
        <div className="mt-5 space-y-2 text-sm text-[#f1d9df]">
          <p>{BRAND_LINES.address}</p>
          <p>{BRAND_LINES.openingHours}</p>
        </div>
      </div>
    </footer>
  );
}
