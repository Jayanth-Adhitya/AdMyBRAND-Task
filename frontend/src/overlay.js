export function syncCanvasSize(video, canvas) {
    const r = video.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }
}
export function drawOverlay(video, canvas, dets) {
    syncCanvasSize(video, canvas);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.font = '12px ui-sans-serif, system-ui';
    ctx.textBaseline = 'top';
    for (const d of dets) {
        const x = d.xmin * canvas.width, y = d.ymin * canvas.height;
        const w = (d.xmax - d.xmin) * canvas.width, h = (d.ymax - d.ymin) * canvas.height;
        ctx.strokeStyle = 'rgba(98,160,255,0.9)';
        ctx.strokeRect(x, y, w, h);
        const label = `${d.label} ${(d.score * 100).toFixed(0)}%`;
        const tw = ctx.measureText(label).width + 8, th = 16;
        ctx.fillStyle = 'rgba(17,24,39,0.9)';
        ctx.fillRect(x, y - 1, tw, th);
        ctx.fillStyle = 'white';
        ctx.fillText(label, x + 4, y + 1);
    }
}
