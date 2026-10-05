# API v0.1

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
| GET | `/api/health` | статус БД, версия модели, backend хранения |
| POST | `/api/analyze` | `id, score, verdict, rules_score, ml_score, signals, urls, advice, duration_ms, limitations` |
| GET | `/api/history` | `{items: [...]}` текущей сессии |
| DELETE | `/api/history` | 204, удалены результаты текущей сессии |
| GET | `/api/dashboard` | count по уровням, дни, признаки, среднее время анализа |
| GET | `/api/reports/{id}.pdf` | PDF; чужой/несуществующий ID — 404 |
| GET | `/api/metrics` | фиксированный эксперимент с hash датасета |

`channel` ∈ `sms, whatsapp, email, url`; `content` — 3–10 000 символов после strip. `verdict` ∈ `low, suspicious, high`. Для URL-only `ml_score` = null. ML-оценка округлена до 0–100 и не является калиброванной вероятностью. `score` — гибридный индекс риска, `rules_score` — capped сумма весов правил.

Ошибки: 422 — неправильное тело/канал/длина; 413 — тело больше 64 KiB; 403 — чужой origin; 429 — больше RATE_LIMIT изменяющих запросов за минуту на peer IP; 404 — недоступный отчёт. API-ответы имеют `Cache-Control: no-store`. Лимитер рассчитан на один процесс, не на распределённую промышленную защиту.
