import { useState, type FormEvent } from "react";

interface Props {
  initialText?: string;
  initialDue: string;
  submitLabel: string;
  /** Если задан, показывается выбор предмета (форма в разделе «Все домашки»). */
  subjects?: string[];
  initialSubject?: string;
  onSubmit: (value: { text: string; due_date: string; subject: string }) => Promise<void>;
  onCancel: () => void;
}

const fieldClass =
  "w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-fg placeholder:text-muted/70 focus-visible:outline-2";

export function HomeworkForm({
  initialText = "",
  initialDue,
  submitLabel,
  subjects,
  initialSubject = "",
  onSubmit,
  onCancel,
}: Props) {
  const [text, setText] = useState(initialText);
  const [due, setDue] = useState(initialDue);
  const [subject, setSubject] = useState(initialSubject || subjects?.[0] || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setError("Напишите, что задали");
    if (!due) return setError("Выберите срок сдачи");
    // Предмет нужен только в форме с выбором предмета; в карточке пары он задаётся самой парой.
    if (subjects && !subject) return setError("Выберите предмет");
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ text, due_date: due, subject });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl border border-line bg-surface-2 p-3">
      {subjects && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">Предмет</span>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldClass}>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-muted">Что задали</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={2000}
          autoFocus
          placeholder="Например: упр. 5–7, стр. 42"
          className={`${fieldClass} resize-y`}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-muted">Сдать до</span>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={fieldClass} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 flex-1 rounded-xl bg-primary px-4 font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Сохраняю…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="min-h-11 rounded-xl border border-line px-4 font-medium transition-colors hover:bg-surface"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
