# Примечание о локальном интерфейсе

Анализ, история, обзор, пакет, сравнение и PDF работают в браузере и не используют следующие API. Аккаунт и архив метрик остаются отдельными сетевыми функциями. Прямой вызов серверного API по-прежнему передаёт ему данные. См. [локальный помощник](local-assistant.md).

# API v0.2

Интерактивный интерфейс API расположен по `/docs`, machine-readable OpenAPI — `/openapi.json`. Обращения same-origin, без CORS. Записывающие browser-запросы с чужим Origin/Sec-Fetch-Site отклоняются. Cookie следует сохранять в интеграционном клиенте.

```bash
curl -c /tmp/qalqan-cookies.txt http://localhost:8000/api/health
curl -b /tmp/qalqan-cookies.txt -c /tmp/qalqan-cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"content":"Срочно! Введите CVV карты.","channel":"sms"}' \
  http://localhost:8000/api/analyze
curl -b /tmp/qalqan-cookies.txt http://localhost:8000/api/history
```

| Метод | Путь | Результат |
|---|---|---|
| GET | `/api/health` | статус БД, версия модели, backend хранения, наличие настройки БД, устойчивость истории и версия deployment |
| POST | `/api/analyze` | `id, score, verdict, rules_score, ml_score, signals, urls, advice, duration_ms, limitations` |
| POST | `/api/analyze/batch` | `{items:[{content,channel},...]}`, 1–10 записей; результаты в исходном порядке, counts по уровням |
| GET | `/api/history` | `{items: [...]}` текущей сессии |
| DELETE | `/api/history` | 204, удалены результаты текущей сессии |
| GET | `/api/dashboard` | count по уровням, дни, признаки, среднее время анализа |
| GET | `/api/reports/{id}.pdf` | PDF; чужой/несуществующий ID — 404 |
| GET | `/api/metrics` | фиксированный эксперимент с hash датасета |
| GET | `/api/metrics/adversarial` | отдельные авторские robustness probes с сохранёнными ошибками |
| POST | `/api/checks/{id}/feedback` | `{vote:correct/incorrect,consent:true}`; только владелец доступной проверки |
| GET | `/api/auth/me` | masked контакты текущего аккаунта и доступность доставки |
| POST | `/api/auth/start` | `{email,consent:true}`; возвращает challenge_id и срок, никогда OTP |
| POST | `/api/auth/verify` | `{challenge_id,email_code}`; один код из письма, ротация cookie |
| POST | `/api/auth/logout` | 204, текущий сеанс отозван |
| DELETE | `/api/auth/account` | 204, аккаунт, контакты, все сеансы, история и отзывы удалены |

`channel` ∈ `sms, whatsapp, email, url`; `content` — 3–10 000 символов после strip. `verdict` ∈ `low, suspicious, high`. Для URL-only `ml_score` = null. ML-оценка округлена до 0–100 и не является калиброванной вероятностью. `score` — гибридный индекс риска, `rules_score` — capped сумма весов правил.

Ошибки: 422 — неправильное тело/канал/длина/согласие; 413 — тело больше 64 KiB, включая пакет; 403 — чужой origin; 429 — исчерпана квота, заголовок Retry-After; 404 — недоступная проверка/отчёт; 410 — истёкший, использованный или чужой challenge; 503 — регистрация не настроена; 502 — отправка через провайдера отклонена.

Лимитер атомарный в БД, разделяется всеми приложениями с той же базой. Fixed windows — 60 секунд, на границе возможен всплеск до двух квот. Пакет расходует одну единицу **на каждую запись**, остальные изменяющие запросы — одну. AUTH дополнительно ограничен 3 отправками/час на peer и почту. При proxy peer может быть общим адресом; это не tenant-level банковский limiter. API-ответы имеют `Cache-Control: no-store`.

Без входа результаты привязаны к cookie; после подтверждения контактов — к аккаунту. Запросы другого браузера получают историю только после собственного подтверждения той же пары. История возвращает до 200 доступных результатов; поиск, сортировка, пагинация по 20 и CSV выполняются клиентом. CSV содержит только производные поля, с защитой от формул. Новое поле `scheme` — предположение по словам, а не доказательство схемы. `urls[].brand_matches` описывает сходство с демонстрационным списком брендов.

В health нет строк подключения и секретов. `history_persistence`: `external_database` для подключённой PostgreSQL; `ephemeral` для SQLite в Render; `local_file` для локального SQLite. `database_configured` сообщает только наличие непустой настройки. В `deployment` используются публичные Render commit/instance IDs для проверки после обновления.
