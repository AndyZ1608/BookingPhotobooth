"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarClock,
  Check,
  Clock,
  LogOut,
  Menu,
  RefreshCw,
  PackageOpen,
  Save,
  Settings,
  X,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogActionButton,
  AlertDialogCancelButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import { BOOKING_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/cn";

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

type BookingStatus = keyof typeof BOOKING_STATUS_LABELS;

type SummaryDto = {
  date: string;
  totalToday: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
};

type BookingDto = {
  id: string;
  bookingCode: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  customerName: string;
  customerPhone: string;
  packageId: string | null;
  packageName: string;
  quantity: number;
  note: string | null;
  internalNote: string | null;
  status: BookingStatus;
};

type PackageDto = {
  id: string;
  code: string;
  name: string;
  durationPerShotMinutes: number;
  isActive: boolean;
  sortOrder: number;
};

type BlockedTimeDto = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  reason: string | null;
};

type SettingsDto = {
  openingTime: string;
  closingTime: string;
  slotDurationMinutes: number;
  minimumBookingNoticeMinutes: number;
  maximumBookingDaysAhead: number;
  maximumQuantity: number;
  timezone: "Asia/Ho_Chi_Minh";
};

type TabKey = "bookings" | "packages" | "blocked" | "settings";

const statusClassName: Record<BookingStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  CONFIRMED: "border-sky-200 bg-sky-50 text-sky-800",
  CHECKED_IN: "border-indigo-200 bg-indigo-50 text-indigo-800",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
  NO_SHOW: "border-slate-200 bg-slate-100 text-slate-700",
};

function todayInVietnam() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const json = (await response.json()) as ApiResponse<T>;

  if (!json.success) {
    throw new Error(json.error.message);
  }

  return json.data;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function AdminDashboard({ adminName }: { adminName: string }) {
  const [tab, setTab] = useState<TabKey>("bookings");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [summary, setSummary] = useState<SummaryDto | null>(null);
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTimeDto[]>([]);
  const [settings, setSettings] = useState<SettingsDto | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingDto | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingDto | null>(null);
  const [date, setDate] = useState(todayInVietnam());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [packageId, setPackageId] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blockedForm, setBlockedForm] = useState({
    date: todayInVietnam(),
    startTime: "09:00",
    endTime: "10:00",
    allDay: false,
    reason: "",
  });
  const [packageForm, setPackageForm] = useState({
    id: "",
    code: "",
    name: "",
    durationPerShotMinutes: 10,
    isActive: true,
    sortOrder: 0,
  });

  const filteredParams = useMemo(() => {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (!date && from) params.set("from", from);
    if (!date && to) params.set("to", to);
    if (status) params.set("status", status);
    if (packageId) params.set("packageId", packageId);
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [date, from, packageId, search, status, to]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryData, packageData, settingsData] = await Promise.all([
        fetchJson<SummaryDto>("/api/admin/dashboard/summary"),
        fetchJson<PackageDto[]>("/api/admin/packages"),
        fetchJson<SettingsDto>("/api/admin/settings"),
      ]);

      setSummary(summaryData);
      setPackages(packageData);
      setSettings(settingsData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không tải được dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBookings = useCallback(async () => {
    try {
      setBookings(await fetchJson<BookingDto[]>(`/api/admin/bookings?${filteredParams}`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không tải được danh sách booking.");
    }
  }, [filteredParams]);

  const loadBlockedTimes = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (blockedForm.date) params.set("date", blockedForm.date);
      setBlockedTimes(await fetchJson<BlockedTimeDto[]>(`/api/admin/blocked-times?${params}`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không tải được lịch chặn.");
    }
  }, [blockedForm.date]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDashboard();
    });
  }, [loadDashboard]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadBookings();
    });
  }, [loadBookings]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadBlockedTimes();
    });
  }, [loadBlockedTimes]);

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    window.location.assign("/admin/login");
  }

  async function saveBooking() {
    if (!selectedBooking) return;

    setSaving(true);
    setError("");

    try {
      const updated = await fetchJson<BookingDto>(`/api/admin/bookings/${selectedBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: selectedBooking.customerName,
          customerPhone: selectedBooking.customerPhone,
          note: selectedBooking.note ?? "",
          internalNote: selectedBooking.internalNote ?? "",
          date: selectedBooking.bookingDate,
          startTime: selectedBooking.startTime,
        }),
      });
      setSelectedBooking(updated);
      await Promise.all([loadBookings(), loadDashboard()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không lưu được booking.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(booking: BookingDto, nextStatus: BookingStatus) {
    setSaving(true);
    setError("");

    try {
      const updated = await fetchJson<BookingDto>(`/api/admin/bookings/${booking.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      setSelectedBooking((current) => (current?.id === booking.id ? updated : current));
      await Promise.all([loadBookings(), loadDashboard()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không đổi được trạng thái.");
    } finally {
      setSaving(false);
      setCancelTarget(null);
    }
  }

  async function createBlockedTime() {
    setSaving(true);
    setError("");

    try {
      await fetchJson<BlockedTimeDto>("/api/admin/blocked-times", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(blockedForm),
      });
      setBlockedForm((current) => ({ ...current, reason: "" }));
      await loadBlockedTimes();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không tạo được lịch chặn.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteBlockedTime(id: string) {
    setSaving(true);
    setError("");

    try {
      await fetchJson<{ deleted: true }>(`/api/admin/blocked-times/${id}`, { method: "DELETE" });
      await loadBlockedTimes();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không xóa được lịch chặn.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings() {
    if (!settings) return;

    setSaving(true);
    setError("");

    try {
      const updated = await fetchJson<SettingsDto>("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSettings(updated);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không lưu được settings.");
    } finally {
      setSaving(false);
    }
  }

  async function savePackage() {
    setSaving(true);
    setError("");

    try {
      const payload = {
        code: packageForm.code,
        name: packageForm.name,
        durationPerShotMinutes: packageForm.durationPerShotMinutes,
        isActive: packageForm.isActive,
        sortOrder: packageForm.sortOrder,
      };

      if (packageForm.id) {
        await fetchJson<PackageDto>(`/api/admin/packages/${packageForm.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJson<PackageDto>("/api/admin/packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setPackageForm({
        id: "",
        code: "",
        name: "",
        durationPerShotMinutes: 10,
        isActive: true,
        sortOrder: 0,
      });
      setPackages(await fetchJson<PackageDto[]>("/api/admin/packages"));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không lưu được gói chụp.");
    } finally {
      setSaving(false);
    }
  }

  const navItems: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: "bookings", label: "Lịch đặt", icon: <CalendarClock className="h-4 w-4" /> },
    { key: "packages", label: "Gói chụp", icon: <PackageOpen className="h-4 w-4" /> },
    { key: "blocked", label: "Chặn giờ", icon: <Ban className="h-4 w-4" /> },
    { key: "settings", label: "Cài đặt", icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r bg-white lg:block">
        <div className="p-5">
          <div className="text-lg font-bold text-primary">Photobooth</div>
          <div className="text-sm text-muted-foreground">Xin chào, {adminName}</div>
        </div>
        <nav className="space-y-1 px-3">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold",
                tab === item.key ? "bg-emerald-50 text-primary" : "hover:bg-muted",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section>
        <header className="border-b bg-white">
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileNavOpen(true)}
                title="Mở menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">Dashboard quản trị</h1>
                <p className="text-sm text-muted-foreground">Quản lý lịch đặt và vận hành cửa hàng</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" onClick={loadDashboard} title="Tải lại">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
              <Button type="button" variant="outline" onClick={logout}>
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </Button>
            </div>
          </div>
        </header>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-50 bg-slate-950/50 lg:hidden">
            <div className="h-full w-72 bg-white p-4 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="font-bold text-primary">Photobooth</div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setMobileNavOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setTab(item.key);
                      setMobileNavOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold",
                      tab === item.key ? "bg-emerald-50 text-primary" : "hover:bg-muted",
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        ) : null}

        <div className="space-y-5 p-4">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {summary ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["Tổng hôm nay", summary.totalToday],
                ["Chờ xác nhận", summary.pending],
                ["Đã xác nhận", summary.confirmed],
                ["Hoàn thành", summary.completed],
                ["Đã hủy", summary.cancelled],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="text-sm text-muted-foreground">{label}</div>
                  <div className="mt-2 text-2xl font-bold">{value}</div>
                </div>
              ))}
            </div>
          ) : null}

          {tab === "bookings" ? (
            <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
              <section className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <Field label="Ngày">
                    <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                  </Field>
                  <Field label="Từ ngày">
                    <Input
                      type="date"
                      value={from}
                      disabled={Boolean(date)}
                      onChange={(event) => setFrom(event.target.value)}
                    />
                  </Field>
                  <Field label="Đến ngày">
                    <Input
                      type="date"
                      value={to}
                      disabled={Boolean(date)}
                      onChange={(event) => setTo(event.target.value)}
                    />
                  </Field>
                  <Field label="Trạng thái">
                    <select
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                      className="h-11 w-full rounded-md border bg-white px-3 text-sm"
                    >
                      <option value="">Tất cả</option>
                      {Object.entries(BOOKING_STATUS_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Gói">
                    <select
                      value={packageId}
                      onChange={(event) => setPackageId(event.target.value)}
                      className="h-11 w-full rounded-md border bg-white px-3 text-sm"
                    >
                      <option value="">Tất cả</option>
                      {packages.map((pack) => (
                        <option key={pack.id} value={pack.id}>
                          {pack.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Tìm kiếm">
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Tên, SĐT, mã"
                    />
                  </Field>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[780px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-3">Mã</th>
                        <th className="py-2 pr-3">Giờ</th>
                        <th className="py-2 pr-3">Khách</th>
                        <th className="py-2 pr-3">SĐT</th>
                        <th className="py-2 pr-3">Gói</th>
                        <th className="py-2 pr-3">SL</th>
                        <th className="py-2 pr-3">Trạng thái</th>
                        <th className="py-2 text-right">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((booking) => (
                        <tr key={booking.id} className="border-b last:border-0">
                          <td className="py-3 pr-3 font-bold">{booking.bookingCode}</td>
                          <td className="py-3 pr-3">
                            {booking.startTime} - {booking.endTime}
                          </td>
                          <td className="py-3 pr-3">{booking.customerName}</td>
                          <td className="py-3 pr-3">{booking.customerPhone}</td>
                          <td className="py-3 pr-3">{booking.packageName}</td>
                          <td className="py-3 pr-3">{booking.quantity}</td>
                          <td className="py-3 pr-3">
                            <Badge className={statusClassName[booking.status]}>
                              {BOOKING_STATUS_LABELS[booking.status]}
                            </Badge>
                          </td>
                          <td className="py-3 text-right">
                            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedBooking(booking)}>
                              Xem
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!bookings.length ? (
                    <div className="rounded-md bg-muted p-5 text-center text-sm text-muted-foreground">
                      Không có booking phù hợp.
                    </div>
                  ) : null}
                </div>
              </section>

              <aside className="rounded-lg border bg-white p-4 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 font-bold">
                  <Clock className="h-4 w-4 text-primary" />
                  Timeline trong ngày
                </h2>
                <div className="space-y-2">
                  {bookings.map((booking) => (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => setSelectedBooking(booking)}
                      className="w-full rounded-md border p-3 text-left hover:border-primary"
                    >
                      <div className="flex items-center justify-between">
                        <strong>
                          {booking.startTime} - {booking.endTime}
                        </strong>
                        <Badge className={statusClassName[booking.status]}>
                          {BOOKING_STATUS_LABELS[booking.status]}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {booking.customerName} · {booking.packageName}
                      </div>
                    </button>
                  ))}
                </div>
              </aside>
            </div>
          ) : null}

          {tab === "blocked" ? (
            <section className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold">Chặn thời gian nhận khách</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <Field label="Ngày">
                  <Input
                    type="date"
                    value={blockedForm.date}
                    onChange={(event) =>
                      setBlockedForm((current) => ({ ...current, date: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Bắt đầu">
                  <Input
                    type="time"
                    value={blockedForm.startTime}
                    disabled={blockedForm.allDay}
                    onChange={(event) =>
                      setBlockedForm((current) => ({ ...current, startTime: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Kết thúc">
                  <Input
                    type="time"
                    value={blockedForm.endTime}
                    disabled={blockedForm.allDay}
                    onChange={(event) =>
                      setBlockedForm((current) => ({ ...current, endTime: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Cả ngày">
                  <label className="flex h-11 items-center gap-2 rounded-md border px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={blockedForm.allDay}
                      onChange={(event) =>
                        setBlockedForm((current) => ({ ...current, allDay: event.target.checked }))
                      }
                    />
                    Chặn cả ngày
                  </label>
                </Field>
                <Field label="Lý do">
                  <Input
                    value={blockedForm.reason}
                    onChange={(event) =>
                      setBlockedForm((current) => ({ ...current, reason: event.target.value }))
                    }
                    placeholder="Bảo trì, nghỉ lễ..."
                  />
                </Field>
              </div>
              <Button type="button" className="mt-4" onClick={createBlockedTime} disabled={saving}>
                <Ban className="h-4 w-4" />
                Tạo lịch chặn
              </Button>

              <div className="mt-5 space-y-2">
                {blockedTimes.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-3 rounded-md border p-3 sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="font-bold">
                        {item.date} · {item.allDay ? "Cả ngày" : `${item.startTime} - ${item.endTime}`}
                      </div>
                      <div className="text-sm text-muted-foreground">{item.reason || "Không ghi lý do"}</div>
                    </div>
                    <Button type="button" variant="destructive" size="sm" onClick={() => deleteBlockedTime(item.id)}>
                      Xóa
                    </Button>
                  </div>
                ))}
                {!blockedTimes.length ? (
                  <div className="rounded-md bg-muted p-5 text-center text-sm text-muted-foreground">
                    Chưa có khoảng thời gian bị chặn cho ngày này.
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {tab === "packages" ? (
            <section className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold">Quản lý gói chụp</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <Field label="Mã gói">
                  <Input
                    value={packageForm.code}
                    onChange={(event) =>
                      setPackageForm((current) => ({ ...current, code: event.target.value }))
                    }
                    placeholder="BASIC"
                  />
                </Field>
                <Field label="Tên gói">
                  <Input
                    value={packageForm.name}
                    onChange={(event) =>
                      setPackageForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Gói tiêu chuẩn"
                  />
                </Field>
                <Field label="Phút mỗi lần">
                  <Input
                    type="number"
                    value={packageForm.durationPerShotMinutes}
                    onChange={(event) =>
                      setPackageForm((current) => ({
                        ...current,
                        durationPerShotMinutes: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Thứ tự">
                  <Input
                    type="number"
                    value={packageForm.sortOrder}
                    onChange={(event) =>
                      setPackageForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))
                    }
                  />
                </Field>
                <Field label="Trạng thái">
                  <label className="flex h-11 items-center gap-2 rounded-md border px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={packageForm.isActive}
                      onChange={(event) =>
                        setPackageForm((current) => ({ ...current, isActive: event.target.checked }))
                      }
                    />
                    Đang bán
                  </label>
                </Field>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={savePackage} disabled={saving}>
                  <Save className="h-4 w-4" />
                  {packageForm.id ? "Lưu gói" : "Tạo gói"}
                </Button>
                {packageForm.id ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setPackageForm({
                        id: "",
                        code: "",
                        name: "",
                        durationPerShotMinutes: 10,
                        isActive: true,
                        sortOrder: 0,
                      })
                    }
                  >
                    Hủy sửa
                  </Button>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {packages.map((pack) => (
                  <div key={pack.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground">{pack.code}</div>
                        <div className="text-lg font-bold">{pack.name}</div>
                      </div>
                      <Badge
                        className={
                          pack.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-100 text-slate-700"
                        }
                      >
                        {pack.isActive ? "Đang bán" : "Tạm ẩn"}
                      </Badge>
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      {pack.durationPerShotMinutes} phút mỗi lần
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() =>
                        setPackageForm({
                          id: pack.id,
                          code: pack.code,
                          name: pack.name,
                          durationPerShotMinutes: pack.durationPerShotMinutes,
                          isActive: pack.isActive,
                          sortOrder: pack.sortOrder,
                        })
                      }
                    >
                      Sửa
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {tab === "settings" && settings ? (
            <section className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold">Cài đặt vận hành</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Field label="Giờ mở cửa">
                  <Input
                    type="time"
                    value={settings.openingTime}
                    onChange={(event) => setSettings({ ...settings, openingTime: event.target.value })}
                  />
                </Field>
                <Field label="Giờ đóng cửa">
                  <Input
                    type="time"
                    value={settings.closingTime}
                    onChange={(event) => setSettings({ ...settings, closingTime: event.target.value })}
                  />
                </Field>
                <Field label="Độ dài slot">
                  <Input
                    type="number"
                    value={settings.slotDurationMinutes}
                    onChange={(event) =>
                      setSettings({ ...settings, slotDurationMinutes: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field label="Notice tối thiểu">
                  <Input
                    type="number"
                    value={settings.minimumBookingNoticeMinutes}
                    onChange={(event) =>
                      setSettings({ ...settings, minimumBookingNoticeMinutes: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field label="Số ngày đặt trước">
                  <Input
                    type="number"
                    value={settings.maximumBookingDaysAhead}
                    onChange={(event) =>
                      setSettings({ ...settings, maximumBookingDaysAhead: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field label="Quantity tối đa">
                  <Input
                    type="number"
                    value={settings.maximumQuantity}
                    onChange={(event) =>
                      setSettings({ ...settings, maximumQuantity: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field label="Múi giờ">
                  <Input value={settings.timezone} readOnly />
                </Field>
              </div>
              <Button type="button" className="mt-4" onClick={saveSettings} disabled={saving}>
                <Save className="h-4 w-4" />
                Lưu cài đặt
              </Button>
            </section>
          ) : null}
        </div>
      </section>

      <Dialog open={Boolean(selectedBooking)} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết booking</DialogTitle>
            <DialogDescription>{selectedBooking?.bookingCode}</DialogDescription>
          </DialogHeader>
          {selectedBooking ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Họ tên">
                  <Input
                    value={selectedBooking.customerName}
                    onChange={(event) =>
                      setSelectedBooking({ ...selectedBooking, customerName: event.target.value })
                    }
                  />
                </Field>
                <Field label="Số điện thoại">
                  <Input
                    value={selectedBooking.customerPhone}
                    onChange={(event) =>
                      setSelectedBooking({ ...selectedBooking, customerPhone: event.target.value })
                    }
                  />
                </Field>
                <Field label="Ngày chụp">
                  <Input
                    type="date"
                    value={selectedBooking.bookingDate}
                    onChange={(event) =>
                      setSelectedBooking({ ...selectedBooking, bookingDate: event.target.value })
                    }
                  />
                </Field>
                <Field label="Giờ bắt đầu">
                  <Input
                    type="time"
                    value={selectedBooking.startTime}
                    onChange={(event) =>
                      setSelectedBooking({ ...selectedBooking, startTime: event.target.value })
                    }
                  />
                </Field>
                <Field label="Gói">
                  <Input value={selectedBooking.packageName} readOnly />
                </Field>
              </div>
              <Field label="Ghi chú khách">
                <Textarea
                  value={selectedBooking.note ?? ""}
                  onChange={(event) => setSelectedBooking({ ...selectedBooking, note: event.target.value })}
                />
              </Field>
              <Field label="Ghi chú nội bộ">
                <Textarea
                  value={selectedBooking.internalNote ?? ""}
                  onChange={(event) =>
                    setSelectedBooking({ ...selectedBooking, internalNote: event.target.value })
                  }
                />
              </Field>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <select
                  value={selectedBooking.status}
                  onChange={(event) =>
                    event.target.value === "CANCELLED"
                      ? setCancelTarget(selectedBooking)
                      : changeStatus(selectedBooking, event.target.value as BookingStatus)
                  }
                  className="h-10 rounded-md border bg-white px-3 text-sm"
                  disabled={saving}
                >
                  {Object.entries(BOOKING_STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setSelectedBooking(null)}>
                    Đóng
                  </Button>
                  <Button type="button" onClick={saveBooking} disabled={saving}>
                    <Check className="h-4 w-4" />
                    Lưu
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(cancelTarget)} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogTitle className="text-lg font-bold">Hủy booking?</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-sm text-muted-foreground">
            Booking sẽ chuyển sang trạng thái đã hủy và các slot liên quan sẽ được giải phóng.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancelButton />
            <AlertDialogActionButton
              onClick={() => cancelTarget && changeStatus(cancelTarget, "CANCELLED")}
            >
              Xác nhận hủy
            </AlertDialogActionButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
