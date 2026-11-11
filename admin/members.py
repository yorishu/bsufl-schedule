"""Выдача и отзыв ключей доступа одногруппникам (запускается только локально у администратора).

Примеры:
    python admin/members.py add "Иванов Иван"      # создаст ID и ключ
    python admin/members.py list                   # список участников
    python admin/members.py revoke u03             # отключить доступ

Нужен файл сервисного аккаунта Firebase (Project settings → Service accounts → Generate new private key).
Путь к нему: переменная GOOGLE_APPLICATION_CREDENTIALS или admin/serviceAccount.local.json.
ЭТОТ ФАЙЛ И admin/keys.local.csv НИКОГДА НЕ КОММИТИТЬ (они в .gitignore).

Как работает вход: ID превращается в служебную почту <id>@schedule.invalid,
ключ служит паролем Firebase Auth (провайдер Email/Password). Настоящих писем не отправляется.
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

import firebase_admin
from firebase_admin import auth, credentials, firestore

HERE = Path(__file__).resolve().parent
DEFAULT_CREDS = HERE / "serviceAccount.local.json"
KEYS_FILE = HERE / "keys.local.csv"
EMAIL_DOMAIN = "schedule.invalid"


def init() -> firestore.firestore.Client:
    path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or str(DEFAULT_CREDS)
    if not Path(path).is_file():
        sys.exit(f"Не найден файл сервисного аккаунта: {path}")
    firebase_admin.initialize_app(credentials.Certificate(path))
    # База в проекте названа "default" (без скобок), а не стандартным "(default)".
    return firestore.client(database_id="default")


def next_login(db: firestore.firestore.Client) -> str:
    nums = [
        int(m.group(1))
        for doc in db.collection("members").stream()
        if (m := re.fullmatch(r"u(\d+)", doc.id))
    ]
    return f"u{(max(nums) + 1) if nums else 1:02d}"


def cmd_add(name: str) -> None:
    db = init()
    login = next_login(db)
    key = secrets.token_urlsafe(12)  # ~96 бит, угадать нельзя
    user = auth.create_user(
        uid=login,
        email=f"{login}@{EMAIL_DOMAIN}",
        password=key,
        display_name=name,
    )
    db.collection("members").document(user.uid).set(
        {"name": name, "login": login, "created_at": firestore.firestore.SERVER_TIMESTAMP}
    )
    new_file = not KEYS_FILE.exists()
    with KEYS_FILE.open("a", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        if new_file:
            w.writerow(["id", "name", "key", "created"])
        w.writerow([login, name, key, datetime.now(timezone.utc).isoformat(timespec="seconds")])
    print(f"Готово. Передайте человеку лично:\n  ID:   {login}\n  Ключ: {key}")
    print("Ключ показан один раз (копия в admin/keys.local.csv, этот файл не коммитить).")


def cmd_list() -> None:
    db = init()
    for doc in sorted(db.collection("members").stream(), key=lambda d: d.id):
        print(f"{doc.id}\t{doc.to_dict().get('name', '')}")


def cmd_revoke(login: str) -> None:
    db = init()
    auth.delete_user(login)
    db.collection("members").document(login).delete()
    print(f"Доступ {login} отозван (домашние задания этого человека остаются).")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("add")
    a.add_argument("name")
    sub.add_parser("list")
    r = sub.add_parser("revoke")
    r.add_argument("login")
    args = p.parse_args()
    if args.cmd == "add":
        cmd_add(args.name)
    elif args.cmd == "list":
        cmd_list()
    else:
        cmd_revoke(args.login)


if __name__ == "__main__":
    main()
