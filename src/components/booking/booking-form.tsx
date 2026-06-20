"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Minus, Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { calculateDurationMinutes, calculateTotalPrice, formatVnd } from "@/lib/money";

type ApiSuccess<T> = { success: true; data: T };
type ApiFail = { success: false; error: { code: string; message: string } };
type ApiResponse<T> = ApiSuccess<T> | ApiFail;

type PackageDto = {
  id: string;
  code: string;
  name: string;
  unitPrice: number;
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
  packageName: string;
  quantity: number;
  totalPrice: number;
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

export function BookingForm() {
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [date, setDate] = useState(todayInVietnam());
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
  const [success, setSuccess] = useState<BookingSuccess | null>(null);

  const selectedPackage = packages.find((item) => item.id === selectedPackageId);
  const durationMinutes = selectedPackage
    ? calculateDurationMinutes(quantity, selectedPackage.durationPerShotMinutes)
    : 0;
  const totalPrice = selectedPackage ? calculateTotalPrice(quantity, selectedPackage.unitPrice) : 0;

  const canSubmit = Boolean(
    date && selectedPackageId && selectedTime && customerName.trim() && customerPhone.trim(),
  );

  const summary = useMemo(
    () => [
      ["Ngày chụp", date],
      ["Giờ", selectedTime || "Chưa chọn"],
      ["Thời lượng", durationMinutes ? `${durationMinutes} phút` : "Chưa chọn gói"],
      ["Tổng tiền", formatVnd(totalPrice)],
    ],
    [date, durationMinutes, selectedTime, totalPrice],
  );

  useEffect(() => {
    let active = true;
    setLoadingPackages(true);
    fetch("/api/public/packages")
      .then((response) => parseJson<PackageDto[]>(response))
      .then((json) => {
        if (!active) return;
        if (json.success) {
          setPackages(json.data);
          setSelectedPackageId(json.data[0]?.id ?? "");
        } else {
          setError(json.error.message);
        }
      })
      .catch(() => setError("Không tải được danh sách gói chụp."))
      .finally(() => active && setLoadingPackages(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedPackageId || !date) return;

    const controller = new AbortController();
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
        setError("Không tải được khung giờ trống.");
      })
      .finally(() => setLoadingSlots(false));

    return () => controller.abort();
  }, [date, quantity, selectedPackageId]);

  async function submitBooking() {
    if (!canSubmit || submitting) return;

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
        return;
      }

      setSuccess(json.data);
      setCustomerName("");
      setCustomerPhone("");
      setNote("");
      setSelectedTime("");
    } catch {
      setError("Không gửi được lịch đặt. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-primary text-primary-foreground">
        <div className="container-page flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-semibold opacity-85">Photobooth Booking</p>
            <h1 className="text-xl font-bold">Đặt lịch chụp photobooth</h1>
          </div>
          <CalendarDays className="h-8 w-8" aria-hidden />
        </div>
      </header>

      <section className="container-page grid gap-5 py-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Chọn ngày</Label>
                <Input
                  id="date"
                  type="date"
                  min={todayInVietnam()}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Số lần chụp</Label>
                <div className="flex h-11 items-center rounded-md border bg-white">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    disabled={quantity <= 1}
                    title="Giảm số lần chụp"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center text-base font-bold">{quantity}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
                    disabled={quantity >= maxQuantity}
                    title="Tăng số lần chụp"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">Chọn gói</h2>
              {loadingPackages ? <RefreshCw className="h-4 w-4 animate-spin text-primary" /> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {packages.map((pack) => {
                const active = pack.id === selectedPackageId;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => setSelectedPackageId(pack.id)}
                    className={cn(
                      "rounded-lg border p-4 text-left transition",
                      active
                        ? "border-primary bg-emerald-50 ring-2 ring-primary/15"
                        : "bg-white hover:border-primary/50",
                    )}
                  >
                    <div className="text-lg font-bold">{pack.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {formatVnd(pack.unitPrice)} / lần chụp
                    </div>
                    <div className="mt-3 text-sm font-semibold text-primary">
                      {pack.durationPerShotMinutes} phút mỗi lần
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">Chọn giờ bắt đầu</h2>
              {loadingSlots ? <RefreshCw className="h-4 w-4 animate-spin text-primary" /> : null}
            </div>
            {slots.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTime(slot)}
                    className={cn(
                      "h-11 rounded-md border text-sm font-bold transition",
                      selectedTime === slot
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-white hover:border-primary hover:bg-emerald-50",
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
                {loadingSlots ? "Đang tải khung giờ..." : "Không có khung giờ phù hợp cho lựa chọn này."}
              </div>
            )}
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-bold">Thông tin khách hàng</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerName">Họ tên</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Số điện thoại</Label>
                <Input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="0901234567"
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="note">Ghi chú</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Nhu cầu thêm, số người, dịp chụp..."
              />
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-5 lg:self-start">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold">Tóm tắt đặt lịch</h2>
            <dl className="mt-4 space-y-3">
              {summary.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="text-right text-sm font-bold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-md bg-orange-50 p-3 text-sm font-semibold text-orange-900">
              Vui lòng đến trước khoảng 5 phút để chuẩn bị.
            </div>
            {error ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <Button
              type="button"
              variant="accent"
              className="mt-4 h-12 w-full text-base"
              disabled={!canSubmit || submitting}
              onClick={submitBooking}
            >
              {submitting ? "ĐANG ĐẶT..." : "ĐẶT LỊCH"}
            </Button>
          </div>
        </aside>
      </section>

      <Dialog open={Boolean(success)} onOpenChange={(open) => !open && setSuccess(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-primary">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <DialogTitle>Đặt lịch thành công</DialogTitle>
            <DialogDescription>Mã đặt lịch của bạn đã được ghi nhận.</DialogDescription>
          </DialogHeader>
          {success ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-muted p-3 text-center text-xl font-bold">
                {success.bookingCode}
              </div>
              {[
                ["Ngày chụp", success.bookingDate],
                ["Thời gian", `${success.startTime} - ${success.endTime}`],
                ["Gói chụp", success.packageName],
                ["Số lần chụp", String(success.quantity)],
                ["Tổng tiền", formatVnd(success.totalPrice)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{label}</span>
                  <strong className="text-right">{value}</strong>
                </div>
              ))}
              <p className="rounded-md bg-orange-50 p-3 font-semibold text-orange-900">
                Vui lòng đến trước khoảng 5 phút.
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
