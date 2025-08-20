# Real-time WebRTC VLM — Design Report

## 1. Design Choices

This project is architected as a multi-component system to enable real-time multi-object detection from a mobile phone to a web browser, offering flexibility in inference execution.

*   **Frontend (Vite.js)**: A lightweight web application built with Vite.js and TypeScript. It handles:
    *   WebRTC signaling to establish peer-to-peer connections for video streaming.
    *   User interface for selecting inference mode (WASM or Server), adjusting detection parameters, and displaying results.
    *   Benchmarking functionality to measure performance metrics.
    *   QR code generation for easy mobile device connection.
*   **Backend (FastAPI)**: A Python-based FastAPI application (`server-yolo`) responsible for server-side object detection.
    *   It loads a YOLOv8n model in ONNX format for efficient inference.
    *   Exposes a `/infer` endpoint to receive image frames and return detection results.
*   **Gateway (Node.js Express)**: An Express.js server (`gateway`) acting as an intermediary. It handles:
    *   Serving the static frontend assets.
    *   WebRTC WebSocket signaling (`/ws`).
    *   Proxying inference requests from the frontend to the backend (`/infer`). A custom manual proxy implementation is used to ensure robust handling of `multipart/form-data` streams.
    *   Receiving and saving benchmark metrics to `metrics.json`.
*   **Containerization (Docker & Docker Compose)**: All services are containerized, providing a consistent and isolated development/deployment environment. `docker-compose.yml` orchestrates the `server` and `gateway` services.
*   **Public Access (ngrok)**: For mobile camera access, which requires HTTPS, `ngrok` is integrated via the `start.sh` script. It creates a secure public tunnel to the local gateway, allowing mobile devices to connect and stream video.

## 2. Low-Resource Mode (WASM Inference)

The project supports a "WASM" mode, which is designed for lower resource consumption on the server-side by offloading inference directly to the client's browser.

*   **Client-Side Execution**: In WASM mode, object detection is performed directly within the web browser using TensorFlow.js with a `lite_mobilenet_v2` model. This model is optimized for mobile and web environments, providing a balance between accuracy and performance on client devices.
*   **Reduced Server Load**: By performing inference on the client, the backend server (`server-yolo`) is not involved in the detection process, significantly reducing its computational load and bandwidth requirements. This makes the WASM mode suitable for scenarios where server resources are limited or when a fully client-side solution is preferred.
*   **Browser Compatibility**: TensorFlow.js leverages WebAssembly (WASM) for accelerated execution, ensuring reasonable performance across various modern browsers.

## 3. Backpressure Policy

To manage the flow of video frames and prevent the system from being overwhelmed, especially during server-side inference, a backpressure policy is implemented.

*   **`INFER_EVERY_MS` Throttle**: In `frontend/src/main.ts`, the `INFER_EVERY_MS` constant (set to 100ms) acts as a throttling mechanism. This means that inference is attempted at most every 100 milliseconds (i.e., a maximum of 10 frames per second).
*   **Client-Side Control**: This backpressure is applied at the frontend (client-side). The `setupRVFC` function, which uses `requestVideoFrameCallback`, checks `_now-lastInfer>=INFER_EVERY_MS` before calling `detectWasm()` or `detectServer()`. This ensures that new inference requests are only dispatched after a certain interval has passed since the last inference, regardless of the video stream's frame rate.
*   **Preventing Overload**: This policy prevents the backend server (in Server Mode) or the client's CPU/GPU (in WASM Mode) from being overloaded by a continuous high-frame-rate video stream. It ensures that the inference pipeline has enough time to process each frame before the next one is sent, maintaining system stability and preventing excessive queuing or dropped frames due to resource exhaustion.
*   **Adaptive Performance**: While not dynamically adaptive, this fixed-interval throttling provides a simple yet effective way to manage the computational load and maintain a consistent inference rate, contributing to a smoother user experience by avoiding system slowdowns.
