import { useMemo, useState } from "react";
import type { Homework } from "../types";
import { useApp } from "../lib/app-context";
import { addDays, parseISO, startOfWeek, toISO } from "../lib/dates";
import { HomeworkForm } from "./HomeworkForm";
import { HomeworkItem } from "./HomeworkItem";
import { Icon } from "./Icon";

type DeadlineFilter = "upcoming" | "soon" | "week" | "overdue" | "all";

const DEADLINES: { id: DeadlineFilter; label: string }[] = [
  { id: "upcoming", label: "Предстоящие" },
  { id: "soon", label: "Сегодня и завтра" },
  { id: "week", label: "Эта неделя" },
  { id: "overdue", label: "Просроченные" },
  { id: "all", label: "Все" },
];

export function AllHomework({ homework }: { homework: Homework[] }) {
  const { backend, subjects, todayISO } = useApp();
  const [subject, setSubject] = useState("");
  const [deadline, setDeadline] = useState<DeadlineFilter>("upcoming");
  const [adding, setAdding] = useState(false);

  const today = parseISO(todayISO);
  const tomorrowISO = toISO(addDays(today, 1));
  const weekEndISO = toISO(addDays(startOfWeek(today), 6));

  const list = useMemo(() => {
    return homework
      .filter((hw) => {
        if (subject && hw.subject !== subject) return false;
        switch (deadline) {
          case "upcoming":
            return hw.due_date >= todayISO;
          case "soon":
            return hw.due_date >= todayISO && hw.due_date <= tomorrowISO;
          case "week":
            return hw.due_date >= todayISO && hw.due_date <= weekEndISO;
          case "overdue":
            return hw.due_date < todayISO;
          default:
            return true;
        }
      })
      .sort((a, b) =>
        deadline === "overdue" || deadline === "all"
          ? b.due_date.localeCompare(a.due_date)
          : a.due_date.localeCompare(b.due_date),
      );
  }, [homework, subject, deadline, todayISO, tomorrowISO, weekEndISO]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 basis-64">
          <span className="mb-1 block text-sm font-medium text-muted">Предмет</span>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-fg"
          >
            <option value="">Все предметы</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-4 font-semibold text-on-primary hover:opacity-90"
        >
          <Icon name="plus" className="size-4" />
          Добавить
        </button>
      </div>

      {adding && (
        <HomeworkForm
          subjects={subjects}
          initialDue={toISO(addDays(today, 1))}
          submitLabel="Добавить"
          onCancel={() => setAdding(false)}
          onSubmit={async ({ text, due_date, subject: s }) => {
            await backend.addHomework({ subject: s, lesson_id: null, due_date, text });
            setAdding(false);
          }}
        />
      )}

      <div role="tablist" aria-label="Срок сдачи" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {DEADLINES.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={deadline === d.id}
            onClick={() => setDeadline(d.id)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
              deadline === d.id ? "bg-primary text-on-primary" : "border border-line bg-surface hover:bg-surface-2"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {!backend.homeworkReady ? (
          <p className="py-10 text-center text-muted">Загружаю домашки…</p>
        ) : list.length === 0 ? (
          <p className="py-10 text-center text-muted">Здесь пока пусто</p>
        ) : (
          list.map((hw) => <HomeworkItem key={hw.id} hw={hw} showSubject />)
        )}
      </div>
    </div>
  );
}
