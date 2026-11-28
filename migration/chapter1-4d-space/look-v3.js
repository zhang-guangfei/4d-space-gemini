// One authoritative look state. Babylon only receives a pose once per frame.
// Guard platform pointer-warp packets without accumulating a delayed catch-up turn.
export class LookController {
  constructor(){this.reset();}
  reset(){this.yaw=0;this.pitch=0;this.pendingX=0;this.pendingY=0;this.skipNext=true;this.filtered=0;this.maxPacket=0;this.lastPacket=0;}
  transition(){this.pendingX=0;this.pendingY=0;this.skipNext=true;}
  push(dx,dy,sensitivity=1){
    if(!Number.isFinite(dx)||!Number.isFinite(dy)){this.filtered++;return;}
    let magnitude=Math.hypot(dx,dy);this.lastPacket=magnitude;this.maxPacket=Math.max(this.maxPacket,magnitude);
    if(this.skipNext){this.skipNext=false;return;}
    // A single unusually large OS/browser packet must not snap the camera.
    const maxPacket=512;
    if(magnitude>maxPacket){this.filtered++;return;}
    this.pendingX+=dx*.002*sensitivity;this.pendingY+=dy*.002*sensitivity;
  }
  frame(){
    // Preserve legitimate rapid turns and all normal packets, with no smoothing,
    // per-frame speed cap, delayed replay or frame-rate-dependent sensitivity.
    this.yaw+=this.pendingX;this.pitch=Math.max(-1.42,Math.min(1.42,this.pitch+this.pendingY));
    this.pendingX=0;this.pendingY=0;return {yaw:this.yaw,pitch:this.pitch};
  }
}
