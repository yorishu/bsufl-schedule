import { useState } from "react";
import type { Homework, Lesson } from "../types";
import { useApp } from "../lib/app-context";
import { HomeworkForm } from "./HomeworkForm";
import { HomeworkItem } from "./HomeworkItem";
import { Icon } from "./Icon";

const TYPE_CLASS: Record<string, string> = {
  лекция: "bg-accent/15 text-accent-text",
  практика: "bg-primary/15 text-primary-text",
  семинар: "bg-ok/15 text-ok-text",
};

interface Props {
  lesson: Lesson;
  homework: Homework[];
  isNow: boolean;
  /** Пара идёт параллельно с другими (спецкурсы по выбору). */
  parallel: boolean;
}

export function LessonCard({ lesson, homework, isNow, parallel }: Props) {
  const { backend, defaultDue } = useApp();
  const [adding, setAdding] = useState(false);

  return (
    <article
      className={`rounded-2xl border bg-surface p-3.5 ${
        isNow ? "border-primary ring-2 ring-primary/40" : "border-line"
      }`}
    >
      <div className="flex gap-3">
        <div className="w-12 shrink-0 text-center leading-tight">
          <div className="font-semibold tabular-nums text-primary-text">{lesson.start}</div>
          <div className="text-sm tabular-nums text-muted">{lesson.end}</div>
        </div>
        <div className="min-w-0 flex-1">
          {isNow && (
            <span className="mb-1 inline-block rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">
              Идёт сейчас
            </span>
          )}
          <h3 className="font-semibold leading-snug">{lesson.subject}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${TYPE_CLASS[lesson.type] ?? "bg-surface-2 text-muted"}`}
            >
              {lesson.type}
            </span>
            {lesson.room && (
              <span className="inline-flex items-center gap-1">
                <Icon name="pin" className="size-3.5" />
                {lesson.room}
              </span>
            )}
            {lesson.teacher && <span>{lesson.teacher}</span>}
          </div>
          {parallel && <p className="mt-1.5 text-xs text-muted">Параллельно с другими парами, на выбор</p>}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {homework.map((hw) => (
          <HomeworkItem key={hw.id} hw={hw} />
        ))}
        {adding ? (
          <HomeworkForm
            initialDue={defaultDue(lesson)}
            submitLabel="Добавить"
            onCancel={() => setAdding(false)}
            onSubmit={async ({ text, due_date }) => {
              await backend.addHomework({ subject: lesson.subject, lesson_id: lesson.id, due_date, text });
              setAdding(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-sm font-medium text-muted transition-colors hover:border-primary hover:text-primary-text"
          >
            <Icon name="plus" className="size-4" />
            Домашка
          </button>
        )}
      </div>
    </article>
  );
}
