FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY 04-orders-service /app/04-orders-service

WORKDIR /app/04-orders-service

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

