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
    // @container: в узких колонках (6 дней на широком экране) время переносится над названием,
    // в карточках шире 18rem (телефон, 2-3 колонки) раскладка прежняя.
    <article
      className={`@container min-w-0 rounded-2xl border bg-surface p-3.5 ${
        isNow ? "border-primary ring-2 ring-primary/40" : "border-line"
      }`}
    >
      <div className="flex flex-col gap-1.5 @[18rem]:flex-row @[18rem]:gap-3">
        <div className="flex shrink-0 items-baseline gap-1 leading-tight @[18rem]:block @[18rem]:w-12 @[18rem]:text-center">
          <span className="font-semibold tabular-nums text-primary-text @[18rem]:block">{lesson.start}</span>
          <span className="text-muted @[18rem]:hidden" aria-hidden="true">
            –
          </span>
          <span className="text-sm tabular-nums text-muted @[18rem]:block">{lesson.end}</span>
        </div>
        <div className="min-w-0 flex-1 break-words">
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
