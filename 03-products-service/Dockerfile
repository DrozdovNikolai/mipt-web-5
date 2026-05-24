FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY 03-products-service /app/03-products-service
COPY 06-appendices /app/06-appendices

WORKDIR /app/03-products-service

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

