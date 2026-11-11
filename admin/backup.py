"""Резервная копия домашних заданий и списка участников из Firestore (запускается локально у администратора).

Примеры:
    python admin/backup.py                  # копия в admin/backups/
    python admin/backup.py --keep 30        # после копии оставить только 30 последних
    python admin/backup.py --out D:\\Backups  # сохранить в другую папку

Что создаётся (в имени дата и время запуска):
    backup-2026-11-11_13-30-00.json   полная копия: коллекции homework и members, id документов сохранены,
                                      время в ISO-8601. Из неё можно восстановить данные.
    homework-2026-11-11_13-30-00.csv  то же самое в читаемом виде, открывается в Excel.

Нужен файл сервисного аккаунта Firebase: переменная GOOGLE_APPLICATION_CREDENTIALS или
admin/serviceAccount.local.json. Копии содержат тексты домашних заданий и имена участников:
папка admin/backups в .gitignore, на GitHub не попадает. Ключи доступа в копию НЕ входят.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore

HERE = Path(__file__).resolve().parent
DEFAULT_CREDS = HERE / "serviceAccount.local.json"
DEFAULT_OUT = HERE / "backups"
COLLECTIONS = ("homework", "members")
DATABASE_ID = "default"  # база названа "default" (без скобок), см. firebase.json

CSV_COLUMNS = [
    "id",
    "subject",
    "lesson_id",
    "due_date",
    "text",
    "author_id",
    "author_name",
    "created_at",
    "updated_at",
]


def init() -> tuple[firestore.firestore.Client, str]:
    path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or str(DEFAULT_CREDS)
    if not Path(path).is_file():
        sys.exit(f"Не найден файл сервисного аккаунта: {path}")
    cred = credentials.Certificate(path)
    firebase_admin.initialize_app(cred)
    return firestore.client(database_id=DATABASE_ID), cred.project_id


def jsonable(value: Any) -> Any:
    """Приводит данные Firestore к JSON: время превращается в строку ISO-8601."""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    return value


def dump(db: firestore.firestore.Client) -> dict[str, dict[str, Any]]:
    return {
        name: {doc.id: jsonable(doc.to_dict() or {}) for doc in db.collection(name).stream()}
        for name in COLLECTIONS
    }


def csv_safe(value: Any) -> str:
    """Защита от «формул» в Excel: текст, начинающийся с = + - @, получает апостроф."""
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def write_atomic(path: Path, write) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    write(tmp)
    os.replace(tmp, path)  # атомарно: недописанный файл не остаётся


def write_json(path: Path, payload: dict[str, Any]) -> None:
    write_atomic(path, lambda t: t.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"))


def write_csv(path: Path, data: dict[str, dict[str, Any]]) -> None:
    members = data["members"]
    rows = sorted(
        data["homework"].items(),
        key=lambda kv: (str(kv[1].get("due_date", "")), str(kv[1].get("created_at", ""))),
    )

    def write(tmp: Path) -> None:
        # utf-8-sig: Excel правильно открывает кириллицу
        with tmp.open("w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(CSV_COLUMNS)
            for doc_id, h in rows:
                author_id = h.get("author_id", "")
                author = members.get(author_id, {}).get("name", "(участник удалён)")
                values = [doc_id, h.get("subject"), h.get("lesson_id"), h.get("due_date"), h.get("text"),
                          author_id, author, h.get("created_at"), h.get("updated_at")]
                w.writerow([csv_safe(v) for v in values])

    write_atomic(path, write)


def prune(out: Path, keep: int) -> list[str]:
    """Оставляет `keep` последних копий (JSON и парный CSV), остальные удаляет."""
    removed: list[str] = []
    backups = sorted(out.glob("backup-*.json"))  # в имени дата, поэтому сортировка по имени = по времени
    for old in backups[: max(0, len(backups) - keep)]:
        stamp = old.stem.removeprefix("backup-")
        for victim in (old, out / f"homework-{stamp}.csv"):
            if victim.exists():
                victim.unlink()
                removed.append(victim.name)
    return removed


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT, help="папка для копий (по умолчанию admin/backups)")
    p.add_argument("--keep", type=int, default=0, help="сколько последних копий оставить (0 = не удалять старые)")
    args = p.parse_args()
    if args.keep < 0:
        sys.exit("--keep не может быть отрицательным")

    db, project = init()
    data = dump(db)

    args.out.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    json_path = args.out / f"backup-{stamp}.json"
    csv_path = args.out / f"homework-{stamp}.csv"
    write_json(
        json_path,
        {
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "project": project,
            "database": DATABASE_ID,
            "collections": data,
        },
    )
    write_csv(csv_path, data)

    # Проверка: читаем записанный файл и сверяем количество документов с тем, что получили из Firestore.
    saved = json.loads(json_path.read_text(encoding="utf-8"))["collections"]
    for name in COLLECTIONS:
        if len(saved[name]) != len(data[name]):
            sys.exit(f"ОШИБКА проверки: в файле {len(saved[name])} документов {name}, в базе {len(data[name])}")

    print(f"Готово. Домашних заданий: {len(data['homework'])}, участников: {len(data['members'])}.")
    print(f"  {json_path}\n  {csv_path}")
    if args.keep:
        removed = prune(args.out, args.keep)
        if removed:
            print(f"Удалены старые копии: {', '.join(removed)}")


if __name__ == "__main__":
    main()
