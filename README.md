# Расписание и домашние задания группы 307/2 (БГУИЯ)

Веб-приложение для одной группы: расписание на неделю и домашние задания напротив каждой пары.
Работает с телефона, ставится на главный экран (PWA), есть тёмная и светлая тема.

## Как это устроено

| Часть | Что делает |
|---|---|
| `scraper/` | Python-парсер. Раз в сутки (GitHub Actions) забирает расписание с `timetable.bsufl.by` и сохраняет `public/schedule.json`. |
| `web/` | Фронтенд: Vite + React + TypeScript + Tailwind. |
| Firebase | Firestore (домашние задания, участники) и Auth (вход по ID и ключу). |
| `admin/` | Локальный скрипт выдачи и отзыва ключей одногруппникам. |
| GitHub Pages | Хостинг статики. |

Источник данных описан в [`docs/source.md`](docs/source.md). Сайт расписания открывается только по `http://`.

## Запуск фронтенда локально

```bash
cd web
npm install
cp .env.example .env.local   # впишите конфиг Firebase (Project settings → Your apps → Config)
npm run dev
```

Без Firebase можно посмотреть интерфейс в демо-режиме: `VITE_DEMO=1 npm run dev` (данные в памяти, вход не нужен).

## Парсер

```bash
pip install -r scraper/requirements.txt
python scraper/scrape.py
```

Если сайт недоступен или формат ответа изменился, скрипт падает с понятной ошибкой и **не трогает** старый `public/schedule.json`.

## Предупреждения для пользователей

Если что-то не так, сайт сам пишет об этом вверху страницы:

| Ситуация | Что видят |
|---|---|
| Сайт университета недоступен или изменил формат | «Сайт университета недоступен»: показано последнее сохранённое расписание, оно может быть неактуальным |
| Парсер не запускался больше 48 часов | «Расписание давно не обновлялось» |
| Нет интернета | «Нет соединения с интернетом»: данные из кэша, правки уйдут позже |
| Не загрузилось расписание или домашние задания | Сообщение с кнопкой «Повторить» (для расписания) |

Откуда берётся информация: парсер при **каждом** запуске (в том числе неудачном) пишет `public/status.json`
(`ok`, `checked_at`, `last_success`, `error`); при сбое запуск в Actions помечается красным и вам приходит письмо от GitHub.

Ручное объявление для всех (например, «в субботу сайт на обслуживании»): впишите текст в `public/notice.json`
(`level`: `info`, `warning` или `error`), закоммитьте и запушьте. Чтобы убрать объявление, очистите `text`.

## Выдача ключей одногруппникам

Нужен файл сервисного аккаунта Firebase: `admin/serviceAccount.local.json`
(Project settings → Service accounts → Generate new private key). **Никому не отправлять и не коммитить.**

```bash
pip install -r admin/requirements.txt
python admin/members.py add "Иванов Иван"   # выдаст ID (u02, u03, …) и ключ, передать человеку лично
python admin/members.py list
python admin/members.py reset u03           # новый ключ при том же ID
python admin/members.py rename u03 "Имя"    # исправить имя
python admin/members.py revoke u03          # отключить доступ (ID не переиспользуется)
```

## Резервные копии

```bash
python admin/backup.py              # копия домашних заданий и участников в admin/backups/
python admin/backup.py --keep 30    # и оставить только 30 последних копий
```

Создаются два файла: `backup-ДАТА.json` (полная копия, id документов сохранены) и `homework-ДАТА.csv` (читаемая
таблица, открывается в Excel). Папка `admin/backups/` в `.gitignore`. Ключи доступа в копию не входят.

## Правила Firestore

Лежат в `firestore.rules`. Публикация:

```bash
firebase deploy --only firestore:rules
```

## Деплой

`.github/workflows/deploy.yml` собирает `web/` и публикует на GitHub Pages при пуше в `main` и после каждого
обновления расписания. Для сборки в **Settings → Secrets and variables → Actions** нужны секреты:
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.
В **Settings → Pages** источник: **GitHub Actions**.

## Секреты, которые нельзя коммитить

`admin/serviceAccount.local.json`, `admin/keys.local.csv`, `web/.env.local` (все в `.gitignore`).
