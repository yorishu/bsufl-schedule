import { useState, type FormEvent } from "react";
import type { Backend } from "../types";
import { Icon } from "./Icon";

const fieldClass =
  "w-full rounded-xl border border-line bg-bg px-3 py-3 text-fg placeholder:text-muted/70";

export function Login({ backend }: { backend: Backend }) {
  const [id, setId] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!id.trim() || !key.trim()) return setError("Введите ID и ключ");
    setBusy(true);
    setError(null);
    try {
      await backend.signIn(id, key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
        <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-primary text-on-primary">
          <Icon name="calendar" className="size-6" />
        </div>
        <h1 className="text-xl font-bold">Расписание группы</h1>
        <p className="mt-1 text-sm text-muted">Введите личные ID и ключ, которые вам выдали.</p>

        <label className="mt-5 block">
          <span className="mb-1 block text-sm font-medium text-muted">ID</span>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="u01"
            className={fieldClass}
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-muted">Ключ</span>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            type="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={fieldClass}
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger-text">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 min-h-12 w-full rounded-xl bg-primary font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Вхожу…" : "Войти"}
        </button>
        <button
          type="button"
          onClick={backend.enterGuest}
          disabled={busy}
          className="mt-2 min-h-12 w-full rounded-xl border border-line bg-surface-2 font-semibold text-muted transition-colors hover:text-fg disabled:opacity-60"
        >
          Смотреть без кода
        </button>
      </form>
    </main>
  );
}
