import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ScheduleData } from "./types";
import { AppContext, type AppContextValue } from "./lib/app-context";
import { addDays, formatWeekRange, startOfWeek, toISO } from "./lib/dates";
import { DEMO_MODE, firebaseConfigured } from "./lib/firebase";
import { useDemoBackend } from "./lib/demoBackend";
import { useFirebaseBackend } from "./lib/firebaseBackend";
import { buildDefaultDue, dateRange, groupByDate, loadSchedule } from "./lib/schedule";
import { AllHomework } from "./components/AllHomework";
import { Icon } from "./components/Icon";
import { Login } from "./components/Login";
import { WeekView } from "./components/WeekView";

// Выбор реализации фиксирован на этапе сборки, поэтому порядок хуков не меняется.
const useBackend = DEMO_MODE ? useDemoBackend : useFirebaseBackend;

type Tab = "week" | "homework";

function tabFromHash(): Tab {
  return location.hash === "#/homework" ? "homework" : "week";
}

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute("data-theme") ?? "dark");
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "light" ? "#F8FAFC" : "#0F172A");
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* хранилище недоступно: тема просто не запомнится */
    }
    setTheme(next);
  };
  return [theme, toggle];
}

function Message({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm text-muted">{children}</div>
    </main>
  );
}

export default function App() {
  const backend = useBackend();
  const now = useNow(30_000);
  const [theme, toggleTheme] = useTheme();
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (backend.status !== "signedIn") return;
    loadSchedule().then(setSchedule, (e: Error) => setScheduleError(e.message));
  }, [backend.status]);

  const lessons = schedule?.lessons;
  const lessonsByDate = useMemo(() => groupByDate(lessons ?? []), [lessons]);
  const range = useMemo(() => dateRange(lessons ?? []), [lessons]);
  const defaultDue = useMemo(() => buildDefaultDue(lessons ?? []), [lessons]);
  const subjects = useMemo(() => {
    const set = new Set<string>();
    for (const l of lessons ?? []) set.add(l.subject);
    for (const h of backend.homework) set.add(h.subject);
    return [...set].sort((a, b) => a.localeCompare(b, "ru"));
  }, [lessons, backend.homework]);

  const todayISO = toISO(now);
  const ctx = useMemo<AppContextValue>(
    () => ({ backend, subjects, todayISO, defaultDue }),
    [backend, subjects, todayISO, defaultDue],
  );

  if (!DEMO_MODE && !firebaseConfigured) {
    return (
      <Message>
        <p className="font-semibold text-fg">Не настроено подключение к Firebase</p>
        <p className="mt-2 text-sm">
          Создайте файл <code>web/.env.local</code> по образцу <code>web/.env.example</code>.
        </p>
      </Message>
    );
  }
  if (backend.status === "loading") return <Message>Загрузка…</Message>;
  if (backend.status === "signedOut") return <Login backend={backend} />;

  const isCurrentWeek = toISO(weekStart) === toISO(startOfWeek(now));
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const tabClass = (active: boolean) =>
    `flex min-h-11 items-center gap-2 rounded-xl px-4 font-medium transition-colors ${
      active ? "bg-primary/15 text-primary-text" : "text-muted hover:bg-surface-2"
    }`;

  return (
    <AppContext.Provider value={ctx}>
      <div className="min-h-dvh">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl 2xl:max-w-[1800px] items-center gap-3 px-4">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-on-primary">
              <Icon name="calendar" className="size-4" />
            </div>
            <h1 className="truncate font-bold">Группа {schedule?.group ?? ""}</h1>
            <nav aria-label="Разделы" className="ml-4 hidden gap-1 md:flex">
              <a href="#/" className={tabClass(tab === "week")} aria-current={tab === "week" ? "page" : undefined}>
                <Icon name="calendar" className="size-4" />
                Неделя
              </a>
              <a
                href="#/homework"
                className={tabClass(tab === "homework")}
                aria-current={tab === "homework" ? "page" : undefined}
              >
                <Icon name="book" className="size-4" />
                Все домашки
              </a>
            </nav>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
                className="grid size-11 place-items-center rounded-xl text-muted hover:bg-surface-2"
              >
                <Icon name={theme === "dark" ? "sun" : "moon"} />
              </button>
              <button
                type="button"
                onClick={() => void backend.signOut()}
                aria-label={`Выйти (${backend.user?.name ?? ""})`}
                className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-muted hover:bg-surface-2"
              >
                <span className="hidden max-w-32 truncate sm:inline">{backend.user?.name}</span>
                <Icon name="logout" className="size-4" />
              </button>
            </div>
          </div>

          {tab === "week" && (
            <div className="mx-auto flex h-12 max-w-7xl 2xl:max-w-[1800px] items-center gap-2 px-4 pb-1">
              <button
                type="button"
                onClick={() => setWeekStart((w) => addDays(w, -7))}
                aria-label="Предыдущая неделя"
                className="grid size-11 place-items-center rounded-xl hover:bg-surface-2"
              >
                <Icon name="chevronLeft" />
              </button>
              <p className="min-w-40 text-center font-semibold" aria-live="polite">
                {formatWeekRange(weekStart)}
              </p>
              <button
                type="button"
                onClick={() => setWeekStart((w) => addDays(w, 7))}
                aria-label="Следующая неделя"
                className="grid size-11 place-items-center rounded-xl hover:bg-surface-2"
              >
                <Icon name="chevronRight" />
              </button>
              <button
                type="button"
                onClick={() => setWeekStart(startOfWeek(new Date()))}
                disabled={isCurrentWeek}
                className="ml-auto min-h-11 rounded-xl border border-line px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-40"
              >
                Сегодня
              </button>
            </div>
          )}
        </header>

        <main className="mx-auto max-w-7xl 2xl:max-w-[1800px] px-4 pb-28 pt-4 md:pb-10">
          {backend.error && (
            <p role="alert" className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-text">
              {backend.error}
            </p>
          )}
          {scheduleError && (
            <p role="alert" className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-text">
              {scheduleError}
            </p>
          )}
          {tab === "week" ? (
            schedule ? (
              <>
                <WeekView
                  weekStart={weekStart}
                  lessonsByDate={lessonsByDate}
                  homework={backend.homework}
                  todayISO={todayISO}
                  nowMinutes={nowMinutes}
                  range={range}
                />
                <p className="mt-8 text-center text-xs text-muted">
                  Расписание обновлено: {new Date(schedule.updated_at).toLocaleString("ru-RU")}
                </p>
              </>
            ) : (
              !scheduleError && <p className="py-16 text-center text-muted">Загружаю расписание…</p>
            )
          ) : (
            <AllHomework homework={backend.homework} />
          )}
        </main>

        <nav
          aria-label="Разделы"
          className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur md:hidden"
        >
          <div className="mx-auto grid max-w-md grid-cols-2">
            <a
              href="#/"
              aria-current={tab === "week" ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                tab === "week" ? "text-primary-text" : "text-muted"
              }`}
            >
              <Icon name="calendar" />
              Неделя
            </a>
            <a
              href="#/homework"
              aria-current={tab === "homework" ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                tab === "homework" ? "text-primary-text" : "text-muted"
              }`}
            >
              <Icon name="book" />
              Все домашки
            </a>
          </div>
        </nav>
      </div>
    </AppContext.Provider>
  );
}
