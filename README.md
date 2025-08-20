# Real-time WebRTC VLM — Multi-Object Detection
## Task by Jayanth Adhitya

This project demonstrates real-time multi-object detection using WebRTC for video streaming from a phone to a browser, with inference performed either client-side (WASM) or server-side (YOLOv8n ONNX).

## Features

*   **WebRTC Streaming**: Real-time video stream from a mobile phone camera to a web browser.
*   **Multi-Object Detection**:
    *   **WASM Mode**: Client-side inference using TensorFlow.js COCO-SSD model.
    *   **Server Mode**: Server-side inference using YOLOv8n ONNX model via a FastAPI backend.
*   **QR Code Integration**: Easily connect your phone by scanning a QR code displayed in the browser. Supports public URLs via `ngrok` for mobile camera access over HTTPS.
*   **Benchmarking**: Built-in 30-second benchmark to measure performance metrics like median/P95 latency, processed FPS, and uplink/downlink bandwidth. Results are saved to `metrics.json`.
*   **Dockerized Deployment**: All services are containerized using Docker Compose for easy setup and deployment.

## Getting Started

### Prerequisites

*   Docker and Docker Compose installed.
*   Node.js and npm (for `localtunnel` or `ngrok` if running outside Docker).
*   `ngrok` installed and authenticated (for mobile camera access over public URL).

### One-Command Start (Recommended)

Use the `start.sh` script to build Docker images, start services, and optionally integrate with `ngrok` for mobile access.

1.  **Start in WASM Mode (Client-side inference)**:
    ```bash
    ./start.sh
    ```
    Open `http://localhost:3000` in your browser. Scan the QR code with your phone.

2.  **Start in Server Mode (Server-side inference)**:
    ```bash
    ./start.sh --mode=server
    ```
    Open `http://localhost:3000` in your browser. Scan the QR code with your phone.

3.  **Start with ngrok (for mobile camera access)**:
    If you need to access the camera on your mobile device (which requires HTTPS), use `ngrok`. Ensure `ngrok` is installed and authenticated (`ngrok authtoken <YOUR_AUTH_TOKEN>`).
    ```bash
    ./start.sh --ngrok --mode=server
    ```
    The script will output the `ngrok` public URL. Open this URL in your browser (or scan the QR code on `http://localhost:3000`) with your phone.

### Benchmarking

After starting the application, click the "Start Bench (30s)" button in the browser. The benchmark will run for 30 seconds, and the results (median/P95 latency, processed FPS, bandwidth) will be displayed on the page and saved to `metrics.json` in the project root directory.

You can view the `metrics.json` file directly in your browser by navigating to `http://localhost:3000/metrics.json` (or `https://your-ngrok-url/metrics.json`).

### Development without Docker

If you prefer to run services directly without Docker:

1.  **Backend (`server-yolo`)**:
    ```bash
    cd server-yolo
    python -m venv .venv
    source .venv/bin/activate  # On Windows: .venv\Scripts\activate
    pip install -r requirements.txt
    python export_onnx.py
    uvicorn app:app --host 0.0.0.0 --port 8000
    ```

2.  **Frontend Build (`frontend`)**:
    ```bash
    cd frontend
    npm install
    npm run build
    ```

3.  **Gateway (`gateway`)**:
    ```bash
    cd gateway
    npm install
    npm run dev
    ```
    If using `ngrok` for mobile access, start it in a separate terminal:
    `ngrok http 3000`
    Then, set the `PUBLIC_BASE_URL` environment variable before running the gateway:
    `export PUBLIC_BASE_URL="https://your-ngrok-url"` (or `$env:PUBLIC_BASE_URL="https://your-ngrok-url"` on PowerShell)
    `node server.mjs`

## Project Structure

*   `server-yolo/`: FastAPI backend for YOLOv8n ONNX inference.
    *   `app.py`: FastAPI application.
    *   `export_onnx.py`: Script to convert `yolov8n.pt` to `yolov8n.onnx`.
    *   `yolov8n.pt`: Pre-trained YOLOv8n PyTorch model.
    *   `models/yolov8n.onnx`: Exported ONNX model.
    *   `requirements.txt`: Python dependencies.
    *   `Dockerfile`: Dockerfile for the backend service.
*   `frontend/`: Vite.js frontend application.
    *   `src/main.ts`: Main application logic, including WebRTC and inference calls.
    *   `src/bench.ts`: Benchmarking logic.
    *   `src/overlay.ts`: Canvas drawing for detections.
    *   `src/webrtc.ts`: WebRTC signaling logic.
    *   `index.html`: Main HTML file.
    *   `vite.config.ts`: Vite configuration, including proxy setup for development.
    *   `Dockerfile`: Dockerfile for building the frontend assets.
*   `gateway/`: Node.js Express gateway.
    *   `server.mjs`: Express server handling static file serving, WebRTC signaling (`/ws`), metrics reporting (`/metrics/report`), and proxying inference requests (`/infer`) to the backend.
    *   `Dockerfile`: Dockerfile for the gateway service.
*   `docker-compose.yml`: Defines Docker services (backend and gateway).
*   `start.sh`: A convenience script to build and run the Docker Compose services, with `ngrok` integration.
*   `.gitignore`: Specifies files and directories to be ignored by Git.
*   `metrics.json`: Stores benchmark results.
*   `ngrok.log`: Log file for `ngrok` output when run via `start.sh`.

## Troubleshooting

*   **`Infer failed {"detail":"Not Found"}` or 404 errors for `/infer`**:
    *   Ensure both `server` and `gateway` Docker containers are running.
    *   Verify that the `server-yolo/app.py` is correctly running and listening on port 8000 inside its container.
    *   Check `gateway/server.mjs` for correct proxy configuration. The current setup uses a manual proxy to ensure `multipart/form-data` is handled correctly.
*   **`libGL.so.1: cannot open shared object file`**:
    *   This means the `server-yolo` Docker image is missing necessary OpenGL libraries for OpenCV. Ensure `libgl1` and `libglib2.0-0` are installed in the `runtime` stage of `server-yolo/Dockerfile`.
*   **`yolov8n.pt": not found` during Docker build**:
    *   The `yolov8n.pt` file is being ignored by `.dockerignore`. Remove `yolov8n.pt` from `server-yolo/.dockerignore`.
*   **`package.json` or `server.mjs` not found during Docker build**:
    *   Ensure the `COPY` instructions in `gateway/Dockerfile` correctly specify the paths relative to the build context (e.g., `COPY gateway/package.json` instead of `COPY package.json`).
*   **`ngrok` gets stuck or QR code is `localhost`**:
    *   Ensure `ngrok` is installed and authenticated.
    *   The `start.sh` script now correctly starts `ngrok` in the background and waits for its API to get the public URL before starting Docker Compose. If it still gets stuck, manually stop any lingering `ngrok` processes (`taskkill /PID <PID> /F` on Windows or `kill <PID>` on Linux/macOS).
    *   Verify that `PUBLIC_BASE_URL` is correctly passed as a build argument and environment variable in `docker-compose.yml` and accepted in `gateway/Dockerfile`.
*   **`TypeError [ERR_INVALID_ARG_TYPE]: The "data" argument must be of type string...` for `metrics.json`**:
    *   This indicates `req.body` is `undefined` when writing `metrics.json`. Ensure `bodyParser.json()` middleware is applied to the `/metrics/report` route in `gateway/server.mjs`.
