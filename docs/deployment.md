# Запуск и Render

Рабочий сервис: https://qalqan-finance2.onrender.com. Workspace: My Workspace. GitHub source: Finance2, ветка `codex/qalqan-mvp`. Сервис создан через MCP в Python runtime на бесплатном тарифе; база `qalqan-finance2-db` — PostgreSQL 16 в Frankfurt. DATABASE_URL задаётся только в Render environment, секрет в репозиторий не попадает. Auto deploy выключен: обновление ветки требует Manual Deploy/API trigger.

Фактическое окончание free PostgreSQL: **4 ноября 2026**. Это раньше указанных ноябрьских финалов конкурса. Согласуйте продление или другую базу до этой даты. Free web service может засыпать при простое; откройте демо заранее перед защитой.

Локальный Python и Docker описаны в README. Docker использует Python 3.12, одного непривилегированного пользователя, DejaVu Sans и одну uvicorn-реплику. PostgreSQL хранится в volume, порт БД не публикуется. Пароль задайте в `.env`; не коммитьте его. Для URL подключения применяйте URL-безопасный пароль или percent-encoding.

## Render Blueprint

`render.yaml` описывает бесплатный Python web service и PostgreSQL в одном регионе Frankfurt. Docker остаётся для локального запуска. Шрифт с кириллицей включён в репозиторий, системная установка не нужна. Auto deploy выключен. Применение Blueprint создаёт ресурсы; GitHub PR сам сервис не создаёт.

1. Подключите частный Finance2 к Render и выберите ветку с этим кодом.
2. Создайте Blueprint из `render.yaml`, проверьте доступность бесплатных планов и ограничения. Free Postgres обычно истекает через 30 дней; перед ноябрьским финалом потребуется продлить платным планом или заранее подготовить новую базу. Free web service засыпает при простое.
3. Для `PUBLIC_ORIGIN` задайте фактический адрес сервиса, например `https://qalqan-finance-security-xxxx.onrender.com` без trailing slash. `COOKIE_SECURE=true` и DATABASE_URL из fromDatabase уже предусмотрены.
4. Дождитесь сборки; проверьте `/api/health`, три сценария и загрузку PDF.
5. Если домен изменён, обновите PUBLIC_ORIGIN. Origin браузера и этот параметр должны совпадать.

Для schema validation: Render CLI v2.7+ `render blueprints validate`. YAML проходит локальную проверку структуры, но окончательная платформенная валидация выполняется CLI/Render.

Прокси и CA в managed cloud: Dockerfile принимает optional BuildKit secret `proxy_ca`; `docker build --secret id=proxy_ca,src=/etc/ssl/certs/ca-certificates.crt -t qalqan .`. Сохраняйте конфигурацию proxy и TLS verification. В обычном Render этот секрет не требуется. Не добавляйте session CA в репозиторий.

Не увеличивайте `numInstances` и `--workers` до замены in-memory limiter. В Render peer IP может быть адресом proxy, поэтому лимит может быть общим для пользователей. Для нагрузочного пилота нужно настроить доверенный forwarding и общий limiter; произвольно доверять X-Forwarded-For нельзя.

До банковского пилота: аккаунты/SSO, роли, аудит без исходных сообщений, централизованный limiter, backup/restore, pool БД, timed deletion, load tests, лицензированный источник репутации, dataset governance и независимая оценка.
