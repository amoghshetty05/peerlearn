# CMP-13 Smart Match model service: serves the six trained models over HTTP on port 8000.
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 KERAS_BACKEND=jax KERAS_HOME=/tmp/keras \
    PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
COPY ml/requirements.txt .
RUN pip install -r requirements.txt
COPY ml/smartmatch ./smartmatch
COPY ml/app.py ml/params.yaml ./
COPY ml/models ./models
RUN useradd --system --no-create-home smartmatch
USER smartmatch
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
