import numpy as np, cv2
def letterbox(im, new_shape=(640, 640), color=(114, 114, 114)):
    h, w = im.shape[:2]
    r = min(new_shape[0]/h, new_shape[1]/w)
    nw, nh = int(round(w*r)), int(round(h*r))
    im_resized = cv2.resize(im, (nw, nh), interpolation=cv2.INTER_LINEAR)
    top = (new_shape[0] - nh) // 2; bottom = new_shape[0] - nh - top
    left = (new_shape[1] - nw) // 2; right = new_shape[1] - nw - left
    im_padded = cv2.copyMakeBorder(im_resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color)
    return im_padded, r, (left, top)
