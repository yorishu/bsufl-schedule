import type { ReactNode } from "react";
import { STALE_AFTER_MS, type Notice, type ScraperStatus } from "../lib/status";
import { Icon, type IconName } from "./Icon";

type Level = "error" | "warning" | "info";

export interface Banner {
  id: string;
  level: Level;
  title: string;
  text: ReactNode;
  action?: { label: string; onClick: () => void };
}

const STYLE: Record<Level, { box: string; icon: IconName; role: "alert" | "status" }> = {
  error: { box: "border-danger/40 bg-danger/10 text-danger-text", icon: "alert", role: "alert" },
  warning: { box: "border-primary/40 bg-primary/10 text-primary-text", icon: "alert", role: "status" },
  info: { box: "border-accent/40 bg-accent/10 text-accent-text", icon: "info", role: "status" },
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "неизвестно когда";
  return d.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

interface BuildArgs {
  online: boolean;
  /** Ошибка загрузки schedule.json. */
  scheduleError: string | null;
  onRetrySchedule: () => void;
  /** Ошибка подписки на домашние задания (Firestore). */
  dataError: string | null;
  status: ScraperStatus | null;
  /** Время обновления расписания (поле updated_at из schedule.json). */
  scheduleUpdatedAt: string | null;
  notice: Notice | null;
  now: Date;
}

/** Какие предупреждения показать сейчас: что не так и что с этим делать. */
export function buildBanners({
  online,
  scheduleError,
  onRetrySchedule,
  dataError,
  status,
  scheduleUpdatedAt,
  notice,
  now,
}: BuildArgs): Banner[] {
  const banners: Banner[] = [];

  if (notice) {
    banners.push({ id: "notice", level: notice.level, title: "Объявление", text: notice.text });
  }

  if (!online) {
    banners.push({
      id: "offline",
      level: "warning",
      title: "Нет соединения с интернетом",
      text: "Показаны сохранённые данные. Домашние задания, которые вы добавите сейчас, отправятся, когда появится связь.",
    });
  }

  if (status && !status.ok) {
    banners.push({
      id: "source-down",
      level: "warning",
      title: "Сайт университета недоступен",
      text: `Расписание не удалось обновить, показано последнее сохранённое (${formatWhen(
        status.last_success ?? scheduleUpdatedAt ?? status.checked_at,
      )}). Оно может быть неактуальным, сверьтесь на timetable.bsufl.by. Домашние задания работают как обычно.`,
    });
  } else if (status && now.getTime() - new Date(status.checked_at).getTime() > STALE_AFTER_MS) {
    banners.push({
      id: "stale",
      level: "warning",
      title: "Расписание давно не обновлялось",
      text: `Последняя проверка: ${formatWhen(status.checked_at)}. Расписание может быть неактуальным, сверьтесь на timetable.bsufl.by.`,
    });
  }

  if (scheduleError) {
    banners.push({
      id: "schedule-error",
      level: "error",
      title: "Не удалось загрузить расписание",
      text: online ? scheduleError : "Нет соединения, расписание загрузится, когда связь появится.",
      action: { label: "Повторить", onClick: onRetrySchedule },
    });
  }

  if (dataError) {
    banners.push({
      id: "data-error",
      level: "error",
      title: "Домашние задания временно недоступны",
      text: "Не удалось получить данные с сервера. Проверьте соединение и попробуйте позже. Расписание при этом работает.",
    });
  }

  return banners;
}

/** Отрисовка предупреждений. Пустой список ничего не рисует. */
export function Banners({ banners }: { banners: Banner[] }) {
  if (banners.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {banners.map((b) => {
        const s = STYLE[b.level];
        return (
          <div key={b.id} role={s.role} className={`flex gap-3 rounded-xl border px-4 py-3 ${s.box}`}>
            <Icon name={s.icon} className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{b.title}</p>
              <p className="mt-0.5 text-sm text-fg/90">{b.text}</p>
              {b.action && (
                <button
                  type="button"
                  onClick={b.action.onClick}
                  className="mt-2 min-h-11 rounded-lg border border-current px-4 text-sm font-medium hover:bg-surface-2"
                >
                  {b.action.label}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
