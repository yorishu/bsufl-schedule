import { useEffect, useState } from "react";

/** public/status.json: пишется парсером при каждом запуске (в том числе при сбое). */
export interface ScraperStatus {
  ok: boolean;
  checked_at: string; // ISO-8601
  last_success: string | null;
  error: string | null;
}

/** public/notice.json: ручное объявление для всех (например, «сайт на обслуживании»). Пустой text = нет объявления. */
export interface Notice {
  text: string;
  level: "info" | "warning" | "error";
}

/** Статус не обновлялся дольше этого срока: парсер, вероятно, не запускается. Запуск раз в сутки. */
export const STALE_AFTER_MS = 48 * 3_600_000;

async function fetchJson(name: string): Promise<unknown> {
  const resp = await fetch(new URL(name, document.baseURI), { cache: "no-cache" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

/** null = файла нет или он повреждён: тогда предупреждение просто не показываем. */
export async function loadStatus(): Promise<ScraperStatus | null> {
  try {
    const d = (await fetchJson("status.json")) as Partial<ScraperStatus>;
    if (typeof d.ok !== "boolean" || typeof d.checked_at !== "string") return null;
    return {
      ok: d.ok,
      checked_at: d.checked_at,
      last_success: typeof d.last_success === "string" ? d.last_success : null,
      error: typeof d.error === "string" ? d.error : null,
    };
  } catch {
    return null;
  }
}

export async function loadNotice(): Promise<Notice | null> {
  try {
    const d = (await fetchJson("notice.json")) as Partial<Notice>;
    const text = typeof d.text === "string" ? d.text.trim() : "";
    if (!text) return null;
    const level = d.level === "warning" || d.level === "error" ? d.level : "info";
    return { text: text.slice(0, 500), level };
  } catch {
    return null;
  }
}

/** Статус и объявление: загружаются при старте, раз в 10 минут и при возвращении сети. */
export function useSiteNotices(enabled: boolean): {
  status: ScraperStatus | null;
  notice: Notice | null;
  /** Первая загрузка завершена (успешно или нет): до этого момента нельзя судить, есть ли предупреждения. */
  loaded: boolean;
} {
  const [status, setStatus] = useState<ScraperStatus | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const refresh = () => {
      void Promise.all([loadStatus(), loadNotice()]).then(([s, n]) => {
        if (cancelled) return;
        setStatus(s);
        setNotice(n);
        setLoaded(true);
      });
    };
    refresh();
    const timer = setInterval(refresh, 10 * 60_000);
    window.addEventListener("online", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("online", refresh);
    };
  }, [enabled]);

  return { status, notice, loaded };
}

/** Есть ли у устройства соединение (по событиям браузера). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
