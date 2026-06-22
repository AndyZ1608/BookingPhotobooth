"use client";

import Image from "next/image";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  Minus,
  PackageCheck,
  Plus,
  RefreshCw,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/cn";
import { addMinutesToTime, calculateDurationMinutes } from "@/lib/time";

type ApiSuccess<T> = { success: true; data: T };
type ApiFail = { success: false; error: { code: string; message: string } };
type ApiResponse<T> = ApiSuccess<T> | ApiFail;

type PackageDto = {
  id: string;
  code: string;
  name: string;
  durationPerShotMinutes: number;
};

type AvailabilityDto = {
  times: string[];
  durationMinutes: number;
  settings: {
    maximumQuantity: number;
    openingTime: string;
    closingTime: string;
    slotDurationMinutes: number;
  };
};

type BookingSuccess = {
  bookingCode: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  customerName: string;
  packageName: string;
  quantity: number;
  status: string;
};

function todayInVietnam() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function parseJson<T>(response: Response): Promise<ApiResponse<T>> {
  return response.json() as Promise<ApiResponse<T>>;
}

function isPhoneFormatValid(value: string) {
  if (!value.trim()) return true;
  return /^(0|\+84)[0-9\s.-]{8,15}$/.test(value.trim());
}

export function BookingForm() {
  const today = useMemo(() => todayInVietnam(), []);
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [date, setDate] = useState(today);
  const [quantity, setQuantity] = useState(1);
  const [maxQuantity, setMaxQuantity] = useState(10);
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [success, setSuccess] = useState<BookingSuccess | null>(null);

  const selectedPackage = packages.find((item) => item.id === selectedPackageId);
  const durationMinutes = selectedPackage
    ? calculateDurationMinutes(quantity, selectedPackage.durationPerShotMinutes)
    : 0;
  const endTime =
    selectedTime && durationMinutes > 0 ? addMinutesToTime(selectedTime, durationMinutes) : "";
  const trimmedName = customerName.trim();
  const trimmedPhone = customerPhone.trim();
  const nameError =
    trimmedName.length > 0 && trimmedName.length < 2 ? "Họ tên cần có ít nhất 2 ký tự." : "";
  const phoneError =
    trimmedPhone.length > 0 && !isPhoneFormatValid(trimmedPhone)
      ? "Số điện thoại bắt đầu bằng 0 hoặc +84."
      : "";
  const canSubmit = Boolean(
    date &&
      selectedPackageId &&
      selectedTime &&
      trimmedName &&
      trimmedPhone &&
      !nameError &&
      !phoneError &&
      !submitting,
  );

  const summary = useMemo(
    () => [
      ["Ngày chụp", date || "Chưa chọn"],
      ["Thời gian", selectedTime && endTime ? `${selectedTime} - ${endTime}` : "Chưa chọn"],
      ["Gói chụp", selectedPackage?.name ?? "Chưa chọn"],
      ["Số lần chụp", String(quantity)],
      ["Thời lượng", durationMinutes ? `${durationMinutes} phút` : "Chưa chọn"],
    ],
    [date, durationMinutes, endTime, quantity, selectedPackage?.name, selectedTime],
  );

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoadingPackages(true);

      fetch("/api/public/packages")
        .then((response) => parseJson<PackageDto[]>(response))
        .then((json) => {
          if (!active) return;

          if (json.success) {
            setPackages(json.data);
            setSelectedPackageId((current) => current || json.data[0]?.id || "");
          } else {
            setError(json.error.message);
          }
        })
        .catch(() => {
          if (active) setError("Không tải được danh sách gói chụp.");
        })
        .finally(() => {
          if (active) setLoadingPackages(false);
        });
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedPackageId || !date) return;

    let active = true;
    let controller: AbortController | null = null;

    queueMicrotask(() => {
      if (!active) return;
      controller = new AbortController();
      setLoadingSlots(true);
      setError("");
      setSelectedTime("");

      const params = new URLSearchParams({
        date,
        packageId: selectedPackageId,
        quantity: String(quantity),
      });

      fetch(`/api/public/availability?${params}`, { signal: controller.signal })
        .then((response) => parseJson<AvailabilityDto>(response))
        .then((json) => {
          if (!active) return;

          if (json.success) {
            setSlots(json.data.times);
            setMaxQuantity(json.data.settings.maximumQuantity);
          } else {
            setSlots([]);
            setError(json.error.message);
          }
        })
        .catch((requestError: unknown) => {
          if (requestError instanceof DOMException && requestError.name === "AbortError") return;
          if (active) setError("Không tải được khung giờ trống.");
        })
        .finally(() => {
          if (active) setLoadingSlots(false);
        });
    });

    return () => {
      active = false;
      controller?.abort();
    };
  }, [date, quantity, reloadKey, selectedPackageId]);

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          startTime: selectedTime,
          packageId: selectedPackageId,
          quantity,
          customerName,
          customerPhone,
          note,
        }),
      });
      const json = await parseJson<BookingSuccess>(response);

      if (!json.success) {
        setError(json.error.message);
        if (json.error.code === "SLOT_CONFLICT") {
          setSelectedTime("");
          setReloadKey((value) => value + 1);
        }
        return;
      }

      setSuccess(json.data);
      setCustomerName("");
      setCustomerPhone("");
      setNote("");
      setSelectedTime("");
      setReloadKey((value) => value + 1);
    } catch {
      setError("Không gửi được lịch đặt. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submitBooking}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start"
    >
      <div className="overflow-hidden rounded-[28px] border border-[#e7cdd5] bg-[#fff9f7]/95 shadow-[0_24px_70px_rgba(72,20,38,0.12)]">
        <div className="border-b border-[#e7cdd5] bg-[#481426] px-5 py-5 text-[#fff9f7] sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#e8cbd3]">
            Đặt lịch photobooth
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Chọn một khoảnh khắc dành riêng cho bạn</h2>
          <p className="mt-2 text-sm text-[#f1d9df]">
            Các khung giờ được kiểm tra lại trên hệ thống trước khi xác nhận lịch.
          </p>
        </div>

        <div className="divide-y divide-[#ead4db]">
          <section className="grid gap-4 px-5 py-5 sm:px-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <SectionHeading
              index="1"
              icon={<CalendarDays className="h-4 w-4" aria-hidden />}
              title="Chọn ngày"
              description="Chỉ chọn ngày còn trong thời hạn nhận lịch."
            />
            <div className="space-y-2">
              <Label htmlFor="date">Ngày chụp</Label>
              <Input
                id="date"
                type="date"
                min={today}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="max-w-xs"
              />
            </div>
          </section>

          <section className="grid gap-4 px-5 py-5 sm:px-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <SectionHeading
              index="2"
              icon={<PackageCheck className="h-4 w-4" aria-hidden />}
              title="Chọn gói chụp"
              description="Giá và thời lượng được hệ thống tính lại khi gửi lịch."
            />
            <div className="space-y-3">
              {loadingPackages ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {["basic", "premium"].map((item) => (
                    <div
                      key={item}
                      className="h-32 animate-pulse rounded-[22px] border border-[#ead4db] bg-[#f5e7eb]"
                    />
                  ))}
                </div>
              ) : packages.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {packages.map((pack) => {
                    const active = pack.id === selectedPackageId;
                    return (
                      <button
                        key={pack.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedPackageId(pack.id)}
                        className={cn(
                          "relative rounded-[22px] border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[#6b1837]/25",
                          active
                            ? "border-[#6b1837] bg-[#f8eef1] shadow-[0_14px_35px_rgba(72,20,38,0.12)]"
                            : "border-[#ead4db] bg-white/80 hover:border-[#9c3f5d] hover:bg-[#fff6f8]",
                        )}
                      >
                        {active ? (
                          <span className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-[#6b1837] text-[#fff9f7]">
                            <Check className="h-4 w-4" aria-hidden />
                          </span>
                        ) : null}
                        <div className="pr-10 text-lg font-semibold text-[#2c1720]">
                          {pack.name}
                        </div>
                        <div className="mt-4 inline-flex rounded-full bg-[#f1d9df] px-3 py-1 text-xs font-semibold text-[#6b1837]">
                          {pack.durationPerShotMinutes} phút mỗi lần
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[18px] border border-[#e7cdd5] bg-white/80 p-4 text-sm text-[#735a64]">
                  Chưa có gói chụp đang hoạt động.
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-4 px-5 py-5 sm:px-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <SectionHeading
              index="3"
              icon={<RefreshCw className="h-4 w-4" aria-hidden />}
              title="Chọn số lần chụp"
              description={`Tối đa ${maxQuantity} lần cho mỗi lịch.`}
            />
            <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
              <div className="flex h-12 items-center overflow-hidden rounded-full border border-[#e7cdd5] bg-white">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  disabled={quantity <= 1}
                  title="Giảm số lần chụp"
                  aria-label="Giảm số lần chụp"
                  className="h-12 w-12 rounded-none text-[#6b1837]"
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </Button>
                <div className="flex-1 text-center text-lg font-semibold text-[#2c1720]">
                  {quantity}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
                  disabled={quantity >= maxQuantity}
                  title="Tăng số lần chụp"
                  aria-label="Tăng số lần chụp"
                  className="h-12 w-12 rounded-none text-[#6b1837]"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <div className="rounded-[20px] border border-[#ead4db] bg-[#fff6f8] p-4 text-sm text-[#735a64]">
                <div className="flex items-center gap-2 font-semibold text-[#6b1837]">
                  <Clock3 className="h-4 w-4" aria-hidden />
                  Thời lượng dự kiến: {durationMinutes || 0} phút
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 px-5 py-5 sm:px-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <SectionHeading
              index="4"
              icon={<Clock3 className="h-4 w-4" aria-hidden />}
              title="Chọn thời gian"
              description="Cần đủ các slot 10 phút liên tục cho lựa chọn của bạn."
            />
            <div>
              <div className="mb-3 flex min-h-5 items-center justify-between gap-3 text-sm text-[#735a64]">
                <span>
                  {selectedPackage
                    ? `${selectedPackage.name} · ${quantity} lần · ${durationMinutes} phút`
                    : "Chọn gói để tải khung giờ"}
                </span>
                {loadingSlots ? (
                  <span className="inline-flex items-center gap-1 font-medium text-[#6b1837]">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Đang tải
                  </span>
                ) : null}
              </div>
              {loadingSlots ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                  {Array.from({ length: 12 }, (_, index) => (
                    <div
                      key={index}
                      className="h-11 animate-pulse rounded-full border border-[#ead4db] bg-[#f5e7eb]"
                    />
                  ))}
                </div>
              ) : slots.length ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      aria-pressed={selectedTime === slot}
                      onClick={() => setSelectedTime(slot)}
                      className={cn(
                        "h-11 rounded-full border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#6b1837]/25",
                        selectedTime === slot
                          ? "border-[#6b1837] bg-[#6b1837] text-[#fff9f7] shadow-[0_12px_28px_rgba(72,20,38,0.22)]"
                          : "border-[#e7cdd5] bg-white text-[#2c1720] hover:border-[#9c3f5d] hover:bg-[#fff6f8]",
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[18px] border border-[#e7cdd5] bg-white/80 p-4 text-sm text-[#735a64]">
                  Không có khung giờ phù hợp cho lựa chọn này.
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-4 px-5 py-5 sm:px-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <SectionHeading
              index="5"
              icon={<UserRound className="h-4 w-4" aria-hidden />}
              title="Thông tin của bạn"
              description="MOMENTME dùng thông tin này để xác nhận lịch."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerName">Họ tên</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Nguyễn Minh Anh"
                  aria-invalid={Boolean(nameError)}
                />
                {nameError ? <FieldError>{nameError}</FieldError> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Số điện thoại</Label>
                <Input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="0901234567"
                  inputMode="tel"
                  aria-invalid={Boolean(phoneError)}
                />
                {phoneError ? <FieldError>{phoneError}</FieldError> : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="note">Ghi chú tùy chọn</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Dịp chụp, số người, yêu cầu thêm..."
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <aside className="lg:sticky lg:top-5 lg:self-start">
        <section className="rounded-[28px] border border-[#e7cdd5] bg-white/90 p-5 shadow-[0_24px_70px_rgba(72,20,38,0.10)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f1d9df] text-[#6b1837]">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9c3f5d]">
                Xác nhận lịch
              </p>
              <h3 className="text-lg font-semibold text-[#2c1720]">Tóm tắt đặt lịch</h3>
            </div>
          </div>

          <dl className="mt-5 space-y-3">
            {summary.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <dt className="text-sm text-[#735a64]">{label}</dt>
                <dd className="text-right text-sm font-semibold text-[#2c1720]">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 rounded-[20px] border border-[#ead4db] bg-[#fff6f8] p-4 text-sm font-medium text-[#6b1837]">
            Vui lòng đến trước khoảng 5 phút để chuẩn bị.
          </div>

          {error ? (
            <div className="mt-4 rounded-[18px] border border-[#d9a7b5] bg-[#fff1f4] p-4 text-sm text-[#7a1230]">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-3 inline-flex items-center gap-2 font-semibold text-[#6b1837] underline-offset-4 hover:underline"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Tải lại khung giờ
              </button>
            </div>
          ) : null}

          <Button
            type="submit"
            variant="accent"
            className="mt-5 h-12 w-full text-base font-bold"
            disabled={!canSubmit}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ĐANG ĐẶT...
              </span>
            ) : (
              "ĐẶT LỊCH"
            )}
          </Button>
          <p className="mt-3 text-center text-xs font-medium text-[#735a64]">
            MOMENTME sẽ giữ riêng khoảnh khắc này cho bạn.
          </p>
        </section>
      </aside>

      <Dialog open={Boolean(success)} onOpenChange={(open) => !open && setSuccess(null)}>
        <DialogContent className="border-[#e7cdd5] bg-[#fff9f7]">
          <DialogHeader>
            <Image
              src={BRAND.logoPath}
              alt={`Logo ${BRAND.name}`}
              width={180}
              height={50}
              className="mb-4 h-auto w-40"
            />
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#f1d9df] text-[#6b1837]">
              <CheckCircle2 className="h-7 w-7" aria-hidden />
            </div>
            <DialogTitle>Đặt lịch thành công</DialogTitle>
            <DialogDescription>
              Mã đặt lịch của bạn đã được ghi nhận. Hẹn gặp bạn tại {BRAND.name}.
            </DialogDescription>
          </DialogHeader>
          {success ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-[18px] border border-[#ead4db] bg-white p-4 text-center text-xl font-bold text-[#6b1837]">
                {success.bookingCode}
              </div>
              {[
                ["Khách hàng", success.customerName],
                ["Ngày chụp", success.bookingDate],
                ["Thời gian", `${success.startTime} - ${success.endTime}`],
                ["Gói chụp", success.packageName],
                ["Số lần chụp", String(success.quantity)],
                ["Trạng thái", success.status],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-[#735a64]">{label}</span>
                  <strong className="text-right text-[#2c1720]">{value}</strong>
                </div>
              ))}
              <p className="rounded-[18px] bg-[#fff1f4] p-3 font-semibold text-[#6b1837]">
                Vui lòng đến trước khoảng 5 phút để chuẩn bị.
              </p>
              <Button type="button" className="w-full" onClick={() => setSuccess(null)}>
                Đóng
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </form>
  );
}

function SectionHeading({
  index,
  icon,
  title,
  description,
}: {
  index: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6b1837] text-xs font-bold text-[#fff9f7]">
          {index}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f1d9df] text-[#6b1837]">
          {icon}
        </span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-[#2c1720]">{title}</h3>
      <p className="mt-1 text-sm text-[#735a64]">{description}</p>
    </div>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-[#8c1d3c]">{children}</p>;
}
