# Запуск и Render

Обновление локального помощника объединяет ветку опубликованного тёмного интерфейса с PR #3. Важно: одного PR недостаточно — Render публикует `codex/qalqan-mvp`, auto deploy выключен. После зелёного CI нужно перенести проверенный commit в эту ветку без force-push, вызвать Manual Deploy/API trigger и проверить фактический commit/status `live`. Главная содержит карточку «Новый помощник Qalqan»; анализатор — переключатель «Одно сообщение / Диалог» и РУС / ҚАЗ.

Рабочий сервис: https://qalqan-finance2.onrender.com. Workspace: My Workspace. GitHub source: Finance2, ветка `codex/qalqan-mvp`. Сервис создан через MCP в Python runtime на бесплатном тарифе; база `qalqan-finance2-db` — PostgreSQL 16 в Frankfurt. DATABASE_URL задаётся только в Render environment, секрет в репозиторий не попадает. Auto deploy выключен: обновление ветки требует Manual Deploy/API trigger.

Фактическое окончание free PostgreSQL: **4 ноября 2026**. Это раньше указанных ноябрьских финалов конкурса. Согласуйте продление или другую базу до этой даты. Free web service может засыпать при простое; откройте демо заранее перед защитой.

Локальный Python и Docker описаны в README. Docker использует Python 3.12, одного непривилегированного пользователя, DejaVu Sans и одну uvicorn-реплику. PostgreSQL хранится в volume, порт БД не публикуется. Пароль задайте в `.env`; не коммитьте его. Для URL подключения применяйте URL-безопасный пароль или percent-encoding.

## Render Blueprint

`render.yaml` описывает фактические имена `qalqan-finance2` и `qalqan-finance2-db`, репозиторий и ветку, бесплатный Python web service и PostgreSQL в Frankfurt. Имена базы и пользователя совпадают с созданной Render базой. Docker остаётся для локального запуска. Шрифт с кириллицей включён в репозиторий. Auto deploy выключен. Изменение файла само по себе не применяет Blueprint к существующему сервису.

1. Подключите частный Finance2 к Render и выберите ветку с этим кодом.
2. Создайте Blueprint из `render.yaml`, проверьте доступность бесплатных планов и ограничения. Free Postgres обычно истекает через 30 дней; перед ноябрьским финалом потребуется продлить платным планом или заранее подготовить новую базу. Free web service засыпает при простое.
3. `DATABASE_URL` берётся через `fromDatabase`; `REQUIRE_POSTGRES=true` запрещает незаметный переход на SQLite. Origin определяется по документированной переменной Render `RENDER_EXTERNAL_URL`; `PUBLIC_ORIGIN` можно задать явно для своего домена. `COOKIE_SECURE=true` предусмотрен.
4. Дождитесь сборки; проверьте `/api/health`, три сценария и загрузку PDF.
5. Если домен изменён, обновите PUBLIC_ORIGIN. Origin браузера и этот параметр должны совпадать.

Новый Blueprint может создать копии совпадающих ресурсов с суффиксами. Для управления уже созданными сервисом и базой используйте официальный workflow добавления существующих ресурсов в Blueprint, а не предполагайте, что совпадение имён автоматически подключает их. Документация: https://render.com/docs/infrastructure-as-code#adding-an-existing-resource. Доступный в этой сессии MCP не умеет применять Blueprint и не возвращает connection credentials; автоматическая привязка через него не подтверждена.

## Подключение текущей базы и проверка после деплоя

1. В [созданной базе](https://dashboard.render.com/d/dpg-db1i92ou01pc73eit61g-a) скопируйте **Internal Database URL**.
2. В [Environment текущего сервиса](https://dashboard.render.com/web/srv-db1igdqd0e5s73ftf730/env) задайте `DATABASE_URL` этой строкой и `REQUIRE_POSTGRES=true`. Выберите Save and deploy. Значение не отправляется в чат и не коммитится.
3. `/api/health` должен вернуть `storage: postgresql` и `history_persistence: external_database`. Не считать наличие созданной базы подтверждением подключения.
4. Из корня проекта запустите `python -m scripts.verify_persistence record`. Скрипт требует подключённую PostgreSQL, делает синтетическую проверку и сохраняет cookie только в `data/persistence-probe.json` с правами 0600.
5. Перезапустите/повторно разверните Render сервис, затем выполните `python -m scripts.verify_persistence verify`. Проверка требует изменения commit или instance ID и подтверждает доступ к исходной записи и PDF с прежней сессией.

Файл состояния содержит session cookie: он исключён из Git, не включайте его в архивы и не публикуйте. Скрипт не выводит cookie. Для повторного эксперимента укажите другой `--state`; существующий probe не перезаписывается. Интеграционный тест `tests.postgres_smoke` также пересоздаёт приложение и проверяет историю/PDF, но это не заменяет проверку реального Render redeploy.

Для schema validation: Render CLI v2.7+ `render blueprints validate`. YAML проходит локальную проверку структуры, но окончательная платформенная валидация выполняется CLI/Render.

Прокси и CA в managed cloud: Dockerfile принимает optional BuildKit secret `proxy_ca`; `docker build --secret id=proxy_ca,src=/etc/ssl/certs/ca-certificates.crt -t qalqan .`. Сохраняйте конфигурацию proxy и TLS verification. В обычном Render этот секрет не требуется. Не добавляйте session CA в репозиторий.

Общий SQL limiter и PostgreSQL connection pool реализованы. Перед увеличением `numInstances`/`--workers` подключите одну PostgreSQL, задайте одинаковый AUTH_SECRET всем репликам, проверьте допустимое число соединений (до 5 на процесс), trust proxy и нагрузку. В Render peer может быть адресом proxy, поэтому лимит бывает общим для пользователей; произвольно доверять X-Forwarded-For нельзя. Сервис сейчас остаётся одной бесплатной репликой.

Регистрация по почте: [настройка Resend](auth-setup.md). Реальная доставка требует ключа Resend и адреса отправителя. На Render с SQLite регистрация недоступна, даже если ключи заданы.

До банковского пилота: аккаунты/SSO, роли, аудит без исходных сообщений, централизованный limiter, backup/restore, pool БД, timed deletion, load tests, лицензированный источник репутации, dataset governance и независимая оценка.
