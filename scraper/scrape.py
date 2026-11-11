"""Парсер расписания БГУИЯ для одной группы.

Запрашивает JSON API timetable.bsufl.by, разворачивает правила
(«с даты по дату, по чётным/нечётным неделям») в конкретные пары и
сохраняет результат в public/schedule.json.

Если сайт недоступен или структура ответа изменилась, скрипт завершается
с ошибкой и НЕ трогает старый schedule.json.

Подробности об источнике: docs/source.md
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import string
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, TypedDict

import requests

API_BASE = "http://www.timetable.bsufl.by/api/api"  # именно http: на https порт закрыт
SITE_ORIGIN = "http://timetable.bsufl.by"
DEFAULT_GROUP_NAME = "307/2"
DEFAULT_GROUP_ID = 224003619

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "public" / "schedule.json"

# Окно запроса по умолчанию: от понедельника две недели назад и на 150 дней вперёд.
DAYS_BACK = 14
DAYS_FORWARD = 150

TYPE_NAMES: dict[str, str] = {
    "Лек": "лекция",
    "Практ": "практика",
    "Сем": "семинар",
    "уч. зан.": "учебное занятие",
}

REQUIRED_KEYS = (
    "dateIn",
    "dateOut",
    "dayNumber",
    "lessonNumber",
    "timeIn",
    "timeOut",
    "disciplineFull",
    "disciplineType",
    "isEven",
)


class Lesson(TypedDict):
    id: str
    date: str
    weekday: int
    start: str
    end: str
    subject: str
    type: str
    teacher: str
    room: str


class ScrapeError(Exception):
    """Понятная ошибка парсера (сеть, формат ответа, проверки)."""


def base36(n: int) -> str:
    digits = string.digits + string.ascii_lowercase
    out = ""
    while n:
        n, r = divmod(n, 36)
        out = digits[r] + out
    return out or "0"


def build_headers() -> dict[str, str]:
    """Заголовки, которые добавляет сам сайт. Без них API отвечает 401."""
    now_ms = int(time.time() * 1000)
    rand = "".join(random.choices(string.digits + string.ascii_lowercase, k=13))
    return {
        "User-Agent": "Mozilla/5.0 (compatible; group-schedule-bot/1.0)",
        "Accept": "application/json",
        "Referer": SITE_ORIGIN + "/",
        "Origin": SITE_ORIGIN,
        "X-Request-Origin": SITE_ORIGIN,
        "X-Timestamp": str(now_ms),
        "X-Request-Id": f"{base36(now_ms)}-{rand}",
    }


def fetch_rules(group_id: int, start: date, end: date) -> list[dict[str, Any]]:
    url = f"{API_BASE}/groupschedule"
    params = {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "idGroup": str(group_id),
    }
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            resp = requests.get(url, params=params, headers=build_headers(), timeout=30)
            if resp.status_code != 200:
                raise ScrapeError(
                    f"API вернул HTTP {resp.status_code} (ожидали 200): {resp.text[:200]!r}"
                )
            try:
                data = resp.json()
            except ValueError as exc:
                raise ScrapeError(f"Ответ API не является JSON: {resp.text[:200]!r}") from exc
            if not isinstance(data, list):
                raise ScrapeError(f"Ожидали список правил, получили {type(data).__name__}")
            return data
        except (requests.RequestException, ScrapeError) as exc:
            last_error = exc
            print(f"Попытка {attempt}/3 не удалась: {exc}", file=sys.stderr)
            if attempt < 3:
                time.sleep(5 * attempt)
    raise ScrapeError(f"Не удалось получить расписание: {last_error}")


def week_parity(d: date) -> int:
    """1 для чётных ISO-недель, 2 для нечётных.

    Проверено на данных сайта: isEven == 1 соответствует чётной ISO-неделе
    (31.08.2026 — 36-я неделя, isEven == 1). Согласованность проверяется
    в validate_rules(), поэтому при смене схемы парсер упадёт, а не соврёт.
    """
    return 1 if d.isocalendar().week % 2 == 0 else 2


def parse_date(value: Any, field: str) -> date:
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError as exc:
        raise ScrapeError(f"Неверная дата в поле {field}: {value!r}") from exc


def validate_rules(rules: list[dict[str, Any]]) -> None:
    if not rules:
        raise ScrapeError("API вернул пустое расписание. Не перезаписываю старый файл.")
    for rule in rules:
        missing = [k for k in REQUIRED_KEYS if k not in rule]
        if missing:
            raise ScrapeError(f"В ответе нет полей {missing}: структура API изменилась.")
        if rule["isEven"] not in (1, 2):
            raise ScrapeError(f"Неожиданное значение isEven={rule['isEven']!r}")
        d_in = parse_date(rule["dateIn"], "dateIn")
        d_out = parse_date(rule["dateOut"], "dateOut")
        # Проверка схемы чётности на правилах из одной недели.
        if (d_out - d_in).days <= 6 and d_in.isoweekday() == 1:
            if week_parity(d_in) != rule["isEven"]:
                raise ScrapeError(
                    f"Схема чётности недель не сходится (правило {rule.get('idSchedule')}, "
                    f"{d_in}): возможно, сменился якорь семестра. Нужна ручная проверка."
                )


def teacher_name(rule: dict[str, Any]) -> str:
    parts = (rule.get("teacherF"), rule.get("teacherN"), rule.get("teacherO"))
    return " ".join(str(p).strip() for p in parts if p and str(p).strip())


def make_id(day: date, start: str, subject: str, lesson_type: str, teacher: str) -> str:
    """Стабильный id. Аудитория не входит: она меняется, а домашнее задание должно остаться."""
    raw = "|".join((day.isoformat(), start, subject, lesson_type, teacher)).lower()
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]


def expand_rules(rules: list[dict[str, Any]], start: date, end: date) -> list[Lesson]:
    lessons: dict[str, Lesson] = {}
    for rule in rules:
        d_in = max(parse_date(rule["dateIn"], "dateIn"), start)
        d_out = min(parse_date(rule["dateOut"], "dateOut"), end)
        weekday = int(rule["dayNumber"])
        subject = str(rule["disciplineFull"]).strip()
        raw_type = str(rule["disciplineType"]).strip()
        lesson_type = TYPE_NAMES.get(raw_type, raw_type)
        teacher = teacher_name(rule)
        room = str(rule.get("classroom") or "").strip()

        day = d_in
        while day <= d_out:
            if day.isoweekday() == weekday and week_parity(day) == rule["isEven"]:
                lesson_id = make_id(day, rule["timeIn"], subject, lesson_type, teacher)
                # Дубли (одно и то же правило записано дважды) схлопываются по id.
                lessons.setdefault(
                    lesson_id,
                    Lesson(
                        id=lesson_id,
                        date=day.isoformat(),
                        weekday=weekday,
                        start=rule["timeIn"],
                        end=rule["timeOut"],
                        subject=subject,
                        type=lesson_type,
                        teacher=teacher,
                        room=room,
                    ),
                )
            day += timedelta(days=1)
    return sorted(lessons.values(), key=lambda x: (x["date"], x["start"], x["subject"], x["teacher"]))


def load_existing(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def save(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)  # атомарно: старый файл не повреждается при сбое


def main() -> int:
    parser = argparse.ArgumentParser(description="Парсер расписания БГУИЯ")
    parser.add_argument("--group-name", default=DEFAULT_GROUP_NAME)
    parser.add_argument("--group-id", type=int, default=DEFAULT_GROUP_ID)
    parser.add_argument("--start", type=date.fromisoformat, help="YYYY-MM-DD")
    parser.add_argument("--end", type=date.fromisoformat, help="YYYY-MM-DD")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    args = parser.parse_args()

    today = date.today()
    start: date = args.start or (today - timedelta(days=today.weekday() + DAYS_BACK))
    end: date = args.end or (today + timedelta(days=DAYS_FORWARD))

    try:
        rules = fetch_rules(args.group_id, start, end)
        validate_rules(rules)
        lessons = expand_rules(rules, start, end)
        if not lessons:
            raise ScrapeError("После разворачивания правил не осталось ни одной пары.")
    except ScrapeError as exc:
        print(f"ОШИБКА: {exc}", file=sys.stderr)
        print("Старый schedule.json не изменён.", file=sys.stderr)
        return 1

    existing = load_existing(args.output)
    if existing and existing.get("group") == args.group_name and existing.get("lessons") == lessons:
        print(f"Без изменений ({len(lessons)} пар), файл не перезаписан.")
        return 0

    payload = {
        "group": args.group_name,
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "lessons": lessons,
    }
    save(args.output, payload)
    print(f"Сохранено {len(lessons)} пар за {start}..{end} → {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
