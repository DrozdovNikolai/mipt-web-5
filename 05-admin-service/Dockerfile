FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY 05-admin-service /app/05-admin-service

WORKDIR /app/05-admin-service

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
