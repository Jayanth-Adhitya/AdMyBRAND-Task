export type Role = 'viewer' | 'publisher'; type Msg = { type: string; [k: string]: any };
export class Signaling {
  ws?: WebSocket; room: string; role: Role; onMessage?: (m: Msg)=>void;
  constructor(room:string, role:Role){ this.room=room; this.role=role; }
  connect(){ return new Promise<void>((res,rej)=>{ const ws = new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws?room=${encodeURIComponent(this.room)}&role=${this.role}`); this.ws=ws; ws.onopen=()=>res(); ws.onerror=e=>rej(e); ws.onmessage=(ev)=>{ try{ const m=JSON.parse(ev.data); this.onMessage?.(m);}catch{}}; }); }
  send(m:Msg){ this.ws?.send(JSON.stringify(m)); }
}
