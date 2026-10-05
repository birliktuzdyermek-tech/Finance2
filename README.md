# Qalqan Finance Security

Конкурсный MVP для трека **Cybersecurity**: анализ финансового фишинга в SMS, WhatsApp, email и URL. Рабочий интерфейс, FastAPI, объяснимые правила, ML baseline, личная история, dashboard и PDF-отчёты.

**Рабочее демо:** https://qalqan-finance2.onrender.com · [Render Dashboard](https://dashboard.render.com/web/srv-db1igdqd0e5s73ftf730) · [Pull request](https://github.com/birliktuzdyermek-tech/Finance2/pull/1)

## Быстрый запуск

Требуется Python 3.12. Выполняйте команды из корня репозитория.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --no-proxy-headers
```

Откройте **http://localhost:8000**. Локально используется SQLite без дополнительной настройки. Шрифт с кириллицей для PDF включён в репозиторий с лицензией. В Windows активируйте `.venv\Scripts\activate`.

## Docker + PostgreSQL

```bash
cp .env.example .env
# Замените POSTGRES_PASSWORD и пароль в DATABASE_URL; используйте URL-безопасный пароль.
docker compose up --build -d
```

Откройте http://localhost:8000. База не публикует порт наружу. `docker compose down` останавливает сервисы и сохраняет данные в volume.

## Демо за 3 минуты

1. Откройте анализатор, выберите пример «Фишинг», нажмите «Проверить на угрозы».
2. Покажите риск-балл, найденные признаки и рекомендацию. Скачайте PDF.
3. Проверьте «Уведомление», затем «Подмена домена».
4. Откройте «Обзор угроз» и «История проверок»: данные получены из выполненных проверок.
5. Откройте «Модель и метрики», объясните ограничения синтетического эксперимента.

## Проверки и эксперимент

```bash
python -m unittest discover -s tests -v
node --check frontend/app.js
python -m ai.dataset.generate
python -m ai.evaluate
```

Датасет включён в репозиторий: 132 строки, 44 авторских шаблона RU/KZ/EN. Обучение: 90 строк / 30 шаблонов; тест: 42 строки / 14 шаблонов. Варианты одного шаблона не пересекают границу train/test. Повторения внутри тестовых групп коррелированы.

| Метод | Precision | Recall | F1 | ROC-AUC | FPR |
|---|---:|---:|---:|---:|---:|
| Правила | 1.000 | 1.000 | 1.000 | 1.000 | 0.000 |
| ML baseline | 0.875 | 1.000 | 0.933 | 1.000 | 0.143 |
| Hybrid, приложение | 0.875 | 1.000 | 0.933 | 1.000 | 0.143 |

**Это результат на малом синтетическом наборе, а не реальная точность банковского продукта.** Простые правила превосходят ML в этом эксперименте. Тест использован при разработке; перед заявлениями об обобщении нужен новый внешний слепой набор. Актуальные метрики, hash датасета, latency и ошибки находятся в `ai/evaluation/`.

## Реализация

- Frontend: адаптивный HTML/CSS/JavaScript без CDN и шага сборки. React оставлен возможным следующим этапом; он не нужен для текущего демо.
- Backend: FastAPI, валидация, лимит тела 64 KiB, rate limit, same-origin записи.
- ML: character TF-IDF (3–5) + Logistic Regression; обучение на фиксированной train-части при старте; безопасная загрузка без pickle.
- Risk Engine: объяснимые признаки текста и структуры URL; риск-балл 0–100, без утверждения о вероятности.
- Storage: SQLite локально; PostgreSQL в Docker и Render. Сохраняются производные признаки и домены, исходные тексты и query strings не сохраняются.
- Session: случайный HttpOnly cookie изолирует истории; это демо-сессия, не банковская аутентификация.
- Reports: PDF с кириллицей, признаки, рекомендации и ограничения.

Ссылки не открываются и не разрешаются через DNS. HTTPS и наличие домена в демонстрационном справочнике не гарантируют безопасность. WHOIS, возраст домена, содержимое страницы, репутационные сервисы и вложения не проверяются. Отрицания распознаются только ограниченной эвристикой.

Для PostgreSQL-развёртывания задайте `REQUIRE_POSTGRES=true`: приложение откажется запускаться с отсутствующей/неверной настройкой вместо незаметного перехода на SQLite. Health endpoint различает подключённую PostgreSQL, локальный SQLite и временное хранилище Render. Проверка истории после реального redeploy: `python -m scripts.verify_persistence record`, затем после deploy — `python -m scripts.verify_persistence verify`. Сначала требуется установить `DATABASE_URL` в Render; подробности — в [инструкции развёртывания](docs/deployment.md).

## Документация и конкурсный пакет

- [Архитектура](docs/architecture.md), [API](docs/api.md), [развёртывание](docs/deployment.md).
- [Методика и техническое приложение](docs/research.md), [dataset card](ai/dataset/README.md).
- [One-pager](presentation/one-pager.md), [резюме RU](presentation/summary-ru.md), [summary EN](presentation/summary-en.md).
- [12 слайдов и заметки](presentation/deck.json), [выступление](presentation/pitch-script.md), [демо и вопросы жюри](presentation/demo-and-qa.md).
- [Roadmap, бюджет, готовность](docs/roadmap.md), [проверки](docs/verification.md).

Чтобы получить PowerPoint и PDF-материалы, установите `pip install -r presentation/requirements.txt` и выполните `python presentation/build.py`. Они появятся в `artifacts/`.

Для короткой записи демо без озвучки: установите Playwright (`pip install playwright`, `python -m playwright install chromium ffmpeg`), запустите приложение и выполните `python presentation/record_demo.py`. Видео сохранится в `artifacts/Qalqan-demo.webm`.

`render.yaml` подготовлен для одной Python-реплики и Managed PostgreSQL на бесплатных демо-тарифах. Настройка `PUBLIC_ORIGIN` и ограничения free tier — в документации. Docker используется для локального развёртывания. Публичный сервис не создаётся самим наличием файла.

Предоставленное описание конкурса использовано как рабочая спецификация. Оригинальный DOCX в этой сессии недоступен: условия подачи и статус внутривузовского этапа нужно сверить с организаторами. Вуз по данным команды: Алматы Технологический Университет; участники: Бірліктұзды Ермек Жақсыбекұлы; Валентинов Ерасыл Оралсеийтович. Роли, руководитель и контакты пока не указаны.
