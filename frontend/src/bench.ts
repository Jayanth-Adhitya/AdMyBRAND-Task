export class Bench {
  e2e: number[] = []; detFrames = 0; tStart = 0; downBytes: number[] = []; upBytes: number[] = [];
  start(){ this.e2e=[]; this.detFrames=0; this.tStart=performance.now(); this.downBytes=[]; this.upBytes=[]; }
  recordE2E(ms: number){ if(Number.isFinite(ms)) this.e2e.push(ms); }
  recordDetFrame(){ this.detFrames++; }
  recordBytes(down?: number, up?: number){ if(typeof down==='number') this.downBytes.push(down); if(typeof up==='number') this.upBytes.push(up); }
  private median(a:number[]){ if(!a.length) return 0; const s=a.slice().sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; }
  private p95(a:number[]){ if(!a.length) return 0; const s=a.slice().sort((x,y)=>x-y); return s[Math.floor(s.length*0.95)]; }
  private kbps(bytes:number[], dur:number){ if(bytes.length<2) return 0; const d=bytes[bytes.length-1]-bytes[0]; return Math.round((d*8)/1000/dur); }
  summary(dur:number){ return { duration_s:dur, e2e_median_ms:Math.round(this.median(this.e2e)), e2e_p95_ms:Math.round(this.p95(this.e2e)), processed_fps:Math.round(10*this.detFrames/dur)/10, downlink_kbps:this.kbps(this.downBytes,dur), uplink_kbps:this.kbps(this.upBytes,dur) }; }
}
