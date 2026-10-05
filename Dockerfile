# syntax=docker/dockerfile:1
FROM python:3.12-slim
WORKDIR /app
# Optional CA mount supports builds behind a managed HTTPS proxy.
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then cp /run/secrets/proxy_ca /usr/local/share/ca-certificates/session-proxy.crt; update-ca-certificates; fi; \
    apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/* /usr/local/share/ca-certificates/session-proxy.crt && update-ca-certificates
COPY requirements.txt ./
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then PIP_CERT=/run/secrets/proxy_ca pip install --no-cache-dir -r requirements.txt; else pip install --no-cache-dir -r requirements.txt; fi
COPY backend ./backend
COPY ai ./ai
COPY frontend ./frontend
RUN useradd --create-home qalqan && mkdir data && chown qalqan:qalqan data
USER qalqan
ENV PORT=8000 PYTHONUNBUFFERED=1
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','8000')+'/api/health', timeout=4)"
CMD ["sh", "-c", "exec uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --no-proxy-headers"]
