import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import * as coco from '@tensorflow-models/coco-ssd';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import { drawOverlay, syncCanvasSize } from './overlay';
import { Bench } from './bench';
import { Signaling } from './webrtc';
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const modeSel = document.getElementById('modeSel');
const startBtn = document.getElementById('startBtn');
const benchBtn = document.getElementById('benchBtn');
const thrInput = document.getElementById('thr');
const maxdInput = document.getElementById('maxd');
const fpsLabel = document.getElementById('fpsLabel');
const medLabel = document.getElementById('medLabel');
const p95Label = document.getElementById('p95Label');
const modeLabel = document.getElementById('modeLabel');
const modeText = document.getElementById('modeText');
const roleLabel = document.getElementById('roleLabel');
const downKbps = document.getElementById('downKbps');
const upKbps = document.getElementById('upKbps');
const procFps = document.getElementById('procFps');
const e2eMed = document.getElementById('e2eMed');
const e2eP95 = document.getElementById('e2eP95');
const qrImg = document.getElementById('qr');
const joinUrlDiv = document.getElementById('joinUrl');
const roomHint = document.getElementById('roomHint');
let cocoModel = null;
let wasmInitialized = false;
let lastInfer = 0;
const INFER_EVERY_MS = 100;
let running = false;
let frames = 0;
let lastFrameTime = 0;
let pc;
let signalling;
let role = 'viewer';
let room = Math.random().toString(36).slice(2, 8);
function parseParams() {
    const url = new URL(location.href);
    role = url.searchParams.get('role') || 'viewer';
    room = url.searchParams.get('room') || room;
    const m = url.searchParams.get('mode');
    if (m)
        modeSel.value = m;
    roleLabel.textContent = role;
    modeLabel.textContent = modeSel.value;
    modeText.textContent = modeSel.value;
    const base = location.origin;
    const pubUrl = `${base}/?role=publisher&room=${encodeURIComponent(room)}&mode=${encodeURIComponent(modeSel.value)}`;
    joinUrlDiv.textContent = pubUrl;
    roomHint.textContent = room;
    qrImg.src = `/qr?room=${encodeURIComponent(room)}&mode=${encodeURIComponent(modeSel.value)}`;
}
parseParams();
async function initWasm() {
    if (wasmInitialized)
        return;
    setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/');
    await tf.setBackend('wasm');
    await tf.ready();
    cocoModel = await coco.load({ base: 'lite_mobilenet_v2' });
    wasmInitialized = true;
}
async function getCam() { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); return stream; }
async function setupWebRTC() {
    signalling = new Signaling(room, role);
    await signalling.connect();
    pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    if (role === 'publisher') {
        const stream = await getCam();
        for (const track of stream.getTracks())
            pc.addTrack(track, stream);
    }
    else {
        pc.ontrack = (e) => { video.srcObject = e.streams[0]; };
    }
    pc.onicecandidate = (e) => { if (e.candidate)
        signalling.send({ type: 'ice', room, candidate: e.candidate }); };
    signalling.onMessage = async (m) => {
        if (m.type === 'offer' && role === 'publisher') {
            await pc.setRemoteDescription(m.sdp);
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            signalling.send({ type: 'answer', room, sdp: pc.localDescription });
        }
        else if (m.type === 'answer' && role === 'viewer') {
            await pc.setRemoteDescription(m.sdp);
        }
        else if (m.type === 'ice' && m.candidate) {
            try {
                await pc.addIceCandidate(m.candidate);
            }
            catch { }
        }
        else if (m.type === 'bench:start') {
            startBench(m.duration, m.mode);
        }
    };
    if (role === 'viewer') {
        const offer = await pc.createOffer({ offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        signalling.send({ type: 'offer', room, sdp: pc.localDescription });
    }
}
function nowMs() { return performance.now(); }
async function detectWasm() {
    if (!cocoModel)
        return;
    const scoreThr = parseFloat(thrInput.value);
    const maxDet = parseInt(maxdInput.value, 10);
    const captureTs = nowMs();
    const w = 320, h = 240;
    const off = new OffscreenCanvas(w, h);
    const ctx = off.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    // @ts-ignore
    const preds = await cocoModel.detect(off, maxDet, scoreThr);
    const dets = preds.map(p => { const [x, y, bw, bh] = p.bbox; return { label: p.class, score: p.score, xmin: x / w, ymin: y / h, xmax: (x + bw) / w, ymax: (y + bh) / h }; });
    bench.recordDetFrame();
    bench.recordE2E(nowMs() - captureTs);
    drawOverlay(video, overlay, dets);
}
async function detectServer() {
    const scoreThr = parseFloat(thrInput.value);
    const maxDet = parseInt(maxdInput.value, 10);
    const captureTs = nowMs();
    const w = video.videoWidth || 1280, h = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise(r => canvas.toBlob(b => r(b), 'image/jpeg', 0.8));
    const form = new FormData();
    form.append('image', blob, 'frame.jpg');
    form.append('score_thr', String(scoreThr));
    form.append('max_det', String(maxDet));
    form.append('capture_ts', String(captureTs));
    const res = await fetch('/infer', { method: 'POST', body: form });
    if (!res.ok) {
        console.warn('Infer failed', await res.text());
        return;
    }
    const out = await res.json();
    const dets = out.detections || [];
    const echoCapture = Number(out.capture_ts) || captureTs;
    bench.recordDetFrame();
    bench.recordE2E(nowMs() - echoCapture);
    drawOverlay(video, overlay, dets);
}
const bench = new Bench();
function setupRVFC() {
    // @ts-ignore
    const rvfc = video.requestVideoFrameCallback?.bind(video);
    const loop = async (_now, metadata) => {
        if (!running)
            return;
        frames++;
        const dt = _now - lastFrameTime;
        if (dt >= 1000) {
            fpsLabel.textContent = String(frames);
            frames = 0;
            lastFrameTime = _now;
        }
        syncCanvasSize(video, overlay);
        if (_now - lastInfer >= INFER_EVERY_MS) {
            lastInfer = _now;
            const mode = modeSel.value;
            if (mode === 'wasm')
                await detectWasm();
            else
                await detectServer();
        }
        rvfc(loop);
    };
    lastFrameTime = performance.now();
    rvfc(loop);
}
async function start() { await setupWebRTC(); if (modeSel.value === 'wasm')
    await initWasm(); running = true; setupRVFC(); }
async function startBench(durationSec = 30, modeOverride) {
    bench.start();
    const DUR = durationSec;
    procFps.textContent = '…';
    e2eMed.textContent = '…';
    e2eP95.textContent = '…';
    const tStats = setInterval(async () => { const stats = await pc.getStats(); stats.forEach(s => { if (s.type === 'inbound-rtp' && s.kind === 'video' && s.bytesReceived)
        bench.recordBytes(s.bytesReceived, undefined); if (s.type === 'outbound-rtp' && s.kind === 'video' && s.bytesSent)
        bench.recordBytes(undefined, s.bytesSent); }); }, 1000);
    await new Promise(r => setTimeout(r, DUR * 1000));
    clearInterval(tStats);
    const s = bench.summary(DUR);
    medLabel.textContent = String(s.e2e_median_ms);
    p95Label.textContent = String(s.e2e_p95_ms);
    procFps.textContent = String(s.processed_fps);
    e2eMed.textContent = String(s.e2e_median_ms);
    e2eP95.textContent = String(s.e2e_p95_ms);
    downKbps.textContent = String(s.downlink_kbps);
    upKbps.textContent = String(s.uplink_kbps);
    await fetch('/metrics/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room, mode: modeOverride || modeSel.value, ...s }) });
}
startBtn.addEventListener('click', start);
benchBtn.addEventListener('click', () => startBench(30));
modeLabel.textContent = modeSel.value;
modeText.textContent = modeSel.value;
