from ultralytics import YOLO
from pathlib import Path

if __name__ == "__main__":
    Path("models").mkdir(parents=True, exist_ok=True)
    model = YOLO("yolov8n.pt")
    model.export(format="onnx", imgsz=640, simplify=True, opset=12)
    onnx_path = Path("yolov8n.onnx")
    if onnx_path.exists():
        onnx_path.rename(Path("models") / "yolov8n.onnx")
        print("Exported -> models/yolov8n.onnx")
