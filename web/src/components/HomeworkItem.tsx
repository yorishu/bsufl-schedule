import { useState } from "react";
import type { Homework } from "../types";
import { authorName, useApp } from "../lib/app-context";
import { describeDue, formatDateTime } from "../lib/dates";
import { HomeworkForm } from "./HomeworkForm";
import { Icon } from "./Icon";

const TONE_CLASS = {
  overdue: "bg-danger/15 text-danger-text",
  soon: "bg-primary/15 text-primary-text",
  normal: "bg-surface text-muted",
} as const;

export function HomeworkItem({ hw, showSubject = false }: { hw: Homework; showSubject?: boolean }) {
  const { backend, todayISO } = useApp();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const due = describeDue(hw.due_date, todayISO);
  const isAuthor = backend.user?.id === hw.author_id;
  const edited = hw.updated_at !== null && hw.created_at !== null && hw.updated_at - hw.created_at > 60_000;

  async function remove() {
    try {
      await backend.removeHomework(hw.id);
    } catch {
      setError("Не удалось удалить");
      setConfirmDelete(false);
    }
  }

  if (editing) {
    return (
      <HomeworkForm
        initialText={hw.text}
        initialDue={hw.due_date}
        submitLabel="Сохранить"
        onCancel={() => setEditing(false)}
        onSubmit={async ({ text, due_date }) => {
          await backend.updateHomework(hw.id, { text, due_date });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      {showSubject && <p className="mb-1 text-sm font-semibold leading-snug">{hw.subject}</p>}
      <p className="whitespace-pre-wrap break-words">{hw.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${TONE_CLASS[due.tone]}`}>
          <Icon name="clock" className="size-3.5" />
          {due.tone === "normal" ? `до ${due.label}` : due.label}
        </span>
        <span className="inline-flex items-center gap-1">
          <Icon name="user" className="size-3.5" />
          {authorName(backend.members, hw.author_id)}
          {hw.created_at !== null && <span>· {formatDateTime(hw.created_at)}</span>}
          {edited && hw.updated_at !== null && <span>· изм. {formatDateTime(hw.updated_at)}</span>}
        </span>
        <span className="ml-auto flex gap-1">
          {confirmDelete ? (
            <>
              <button
                type="button"
                onClick={remove}
                className="min-h-11 rounded-lg px-3 font-medium text-danger-text hover:bg-danger/15"
              >
                Удалить?
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-11 rounded-lg px-3 hover:bg-surface"
              >
                Нет
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Редактировать домашнее задание"
                className="grid size-11 place-items-center rounded-lg hover:bg-surface"
              >
                <Icon name="pencil" className="size-4" />
              </button>
              {isAuthor && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Удалить домашнее задание"
                  className="grid size-11 place-items-center rounded-lg hover:bg-danger/15 hover:text-danger-text"
                >
                  <Icon name="trash" className="size-4" />
                </button>
              )}
            </>
          )}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
