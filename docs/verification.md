# Проверки выполненной реализации

- 40 unittest-проверок: анализ/API, session isolation, PDF, privacy, validation, shared atomic quota, batch rollback, expiry, email OTP/attempts/session binding, legacy schema migration, Resend request, provider failure, account deletion/logout, feedback consent, бренды и bootstrap. Итоговая проверка выполняется перед публикацией.
- Playwright / Chromium: demo, пакет, фильтры, CSV, сравнение, 5 ablation-строк/CI/probes, недоступность ненастроенной доставки, согласие на feedback, PDF/session isolation и мобильное меню. Отдельный mobile-auth browser выполняет настоящий signup/verify/logout с mock только отправки; реальные письма не отправлялись.
- Синтетический evaluation выполнен. Классификационные результаты и hash находятся в `ai/evaluation/metrics.json`; latency зависит от среды.
- Docker build завершился успешно. Образ запускается непривилегированным пользователем.
- PostgreSQL 16: история/PDF после пересоздания, pool reuse, 24 конкурентных резерва из двух экземпляров — ровно 7 допущенных при лимите 7; SQL-сценарий регистрации/подтверждения/удаления с mock доставки.
- Render Blueprint проверен по официальной JSON Schema (`https://render.com/schema/render.yaml.json`). Финальная конфигурация проверяется повторно перед публикацией.
- Резюме RU/EN и one-pager экспортированы в PDF: каждый документ — 1 страница. PowerPoint — 12 редактируемых слайдов, заметки выступающего включены.

Скриншоты и экспортированные материалы находятся в `artifacts/` после выполнения browser smoke / presentation build. CI содержит API, evaluation, PostgreSQL smoke и Docker build. Результат GitHub CI и публичного Render deployment фиксируется отдельно после загрузки кода.

Эти проверки подтверждают работоспособность прототипа, а не точность на реальном банковском трафике или готовность к production.

Локальная нагрузка: 40 запросов при concurrency 8, 40/40 HTTP 200; warm API p95 317 мс в одной managed-среде с SQLite, включая создание клиента и БД. Это не SLA Render или доказательство линейного роста нагрузки. Данные — `artifacts/load-smoke.json`.
