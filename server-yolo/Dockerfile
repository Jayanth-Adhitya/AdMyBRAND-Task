# Stage 1: Builder - for exporting the ONNX model
FROM python:3.11-slim AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

# Copy requirements for export and install them
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy export script and original model
COPY export_onnx.py ./
COPY yolov8n.pt ./

# Run the export script to generate the ONNX model
RUN python export_onnx.py

# Stage 2: Runtime - for the final application
FROM python:3.11-slim AS runtime
WORKDIR /app
ENV PYTHONUNBUFFERED=1

# Install runtime dependencies and necessary system libraries for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

# Copy requirements and install them first to leverage Docker cache
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Copy application code and utilities
COPY app.py ./
COPY utils ./utils

# Copy the exported ONNX model from the builder stage
COPY --from=builder /app/models/yolov8n.onnx ./models/yolov8n.onnx

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
