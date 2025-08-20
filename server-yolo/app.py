from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
import numpy as np, onnxruntime as ort, io, time
from PIL import Image
from pathlib import Path
from utils.nms import nms_boxes
from utils.letterbox import letterbox

COCO80 = ["person","bicycle","car","motorcycle","airplane","bus","train","truck","boat","traffic light",
"fire hydrant","stop sign","parking meter","bench","bird","cat","dog","horse","sheep","cow",
"elephant","bear","zebra","giraffe","backpack","umbrella","handbag","tie","suitcase","frisbee",
"skis","snowboard","sports ball","kite","baseball bat","baseball glove","skateboard","surfboard",
"tennis racket","bottle","wine glass","cup","fork","knife","spoon","bowl","banana","apple",
"sandwich","orange","broccoli","carrot","hot dog","pizza","donut","cake","chair","couch",
"potted plant","bed","dining table","toilet","tv","laptop","mouse","remote","keyboard","cell phone",
"microwave","oven","toaster","sink","refrigerator","book","clock","vase","scissors","teddy bear",
"hair drier","toothbrush"]

app = FastAPI(title="YOLOv8n ONNX Inference")
MODEL_PATH = Path("models/yolov8n.onnx"); SESSION=None; INPUT_NAME=None; IMG_SIZE=640
@app.on_event("startup")
def load_model_on_startup():
    global SESSION, INPUT_NAME
    if not MODEL_PATH.exists():
        raise RuntimeError("models/yolov8n.onnx not found. Run export_onnx.py first.")
    SESSION = ort.InferenceSession(str(MODEL_PATH), providers=[("CPUExecutionProvider", {})])
    INPUT_NAME = SESSION.get_inputs()[0].name

def parse_yolov8_output(out: np.ndarray):
    if out.ndim == 3 and out.shape[1] == 84: out = np.transpose(out[0], (1, 0))
    elif out.ndim == 3 and out.shape[2] == 84: out = out[0]
    elif out.ndim == 2 and out.shape[1] == 84: pass
    else: raise RuntimeError(f"Unexpected YOLOv8 ONNX output shape: {out.shape}")
    boxes_xywh = out[:, :4]; cls_scores = out[:, 4:]; cls_ids = np.argmax(cls_scores, axis=1)
    scores = cls_scores[np.arange(out.shape[0]), cls_ids]; return boxes_xywh, scores, cls_ids
def xywh_center_to_xyxy(b: np.ndarray):
    cx, cy, w, h = b[:,0], b[:,1], b[:,2], b[:,3]
    x1 = cx - w/2; y1 = cy - h/2; x2 = cx + w/2; y2 = cy + h/2
    return np.stack([x1,y1,x2,y2], axis=1)

@app.post("/infer")
async def infer(image: UploadFile = File(...), score_thr: float = Form(0.30), max_det: int = Form(50), capture_ts: float = Form(0.0)):
    raw = await image.read(); im = np.array(Image.open(io.BytesIO(raw)).convert("RGB")); h0, w0 = im.shape[:2]
    recv_ts = time.time()*1000.0
    im_lb, r, (padw, padh) = letterbox(im, new_shape=(IMG_SIZE, IMG_SIZE))
    x = im_lb.astype(np.float32)/255.0; x = x.transpose(2,0,1)[None, ...]
    t0 = time.time()*1000.0; out = SESSION.run(None, {INPUT_NAME: x})[0]; t1 = time.time()*1000.0
    boxes_xywh, scores, cls_ids = parse_yolov8_output(out)
    keep = scores >= score_thr
    if not np.any(keep): return JSONResponse({"detections": [], "capture_ts": capture_ts, "recv_ts": recv_ts, "inference_ts": t1})
    boxes_xywh, scores, cls_ids = boxes_xywh[keep], scores[keep], cls_ids[keep]
    boxes_xyxy = xywh_center_to_xyxy(boxes_xywh)
    keep_idx = nms_boxes(boxes_xyxy, scores, iou_thr=0.45, max_det=max_det)
    boxes_xyxy, scores, cls_ids = boxes_xyxy[keep_idx], scores[keep_idx], cls_ids[keep_idx]
    boxes_xyxy[:, [0,2]] -= padw; boxes_xyxy[:, [1,3]] -= padh; boxes_xyxy /= r
    boxes_xyxy[:, [0,2]] = np.clip(boxes_xyxy[:, [0,2]] / w0, 0, 1)
    boxes_xyxy[:, [1,3]] = np.clip(boxes_xyxy[:, [1,3]] / h0, 0, 1)
    dets=[]; 
    for (x1,y1,x2,y2), s, c in zip(boxes_xyxy, scores, cls_ids):
        dets.append({"label": COCO80[int(c)] if 0 <= int(c) < len(COCO80) else str(int(c)), "score": float(s),
                     "xmin": float(x1), "ymin": float(y1), "xmax": float(x2), "ymax": float(y2)})
    return JSONResponse({"detections": dets, "capture_ts": capture_ts, "recv_ts": recv_ts, "inference_ts": t1})
