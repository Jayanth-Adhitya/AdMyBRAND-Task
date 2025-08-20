import numpy as np
def nms_boxes(boxes, scores, iou_thr=0.45, max_det=300):
    idxs = scores.argsort()[::-1]; keep = []
    while idxs.size > 0 and len(keep) < max_det:
        i = idxs[0]; keep.append(i)
        if idxs.size == 1: break
        ious = iou_numpy(boxes[i], boxes[idxs[1:]])
        idxs = idxs[1:][ious < iou_thr]
    return keep
def iou_numpy(box, boxes):
    x1 = np.maximum(box[0], boxes[:,0]); y1 = np.maximum(box[1], boxes[:,1])
    x2 = np.minimum(box[2], boxes[:,2]); y2 = np.minimum(box[3], boxes[:,3])
    inter = np.maximum(0, x2-x1) * np.maximum(0, y2-y1)
    a1 = (box[2]-box[0])*(box[3]-box[1]); a2 = (boxes[:,2]-boxes[:,0])*(boxes[:,3]-boxes[:,1])
    union = a1 + a2 - inter + 1e-6; return inter / union
