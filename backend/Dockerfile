FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["sh", "-c", "until python3 -c 'import socket; socket.gethostbyname(\"db\")' 2>/dev/null; do echo 'Waiting for db DNS...'; sleep 1; done && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
