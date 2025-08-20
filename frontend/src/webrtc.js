export class Signaling {
    constructor(room, role) { this.room = room; this.role = role; }
    connect() { return new Promise((res, rej) => { const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?room=${encodeURIComponent(this.room)}&role=${this.role}`); this.ws = ws; ws.onopen = () => res(); ws.onerror = e => rej(e); ws.onmessage = (ev) => { try {
        const m = JSON.parse(ev.data);
        this.onMessage?.(m);
    }
    catch { } }; }); }
    send(m) { this.ws?.send(JSON.stringify(m)); }
}
