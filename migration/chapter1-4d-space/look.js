// One authoritative look state. Babylon only receives a pose once per frame.
// Guard platform pointer-warp packets without accumulating a delayed catch-up turn.
export class LookController {
  constructor(){this.reset();}
  reset(){this.yaw=0;this.pitch=0;this.free=false;this.quaternion=[0,0,0,1];this.pendingX=0;this.pendingY=0;this.skipNext=true;this.filtered=0;this.maxPacket=0;this.lastPacket=0;}
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
  // Attitude is expressed in the parallel-transported cell frame. Crossing a
  // doorway transports that frame, not this local quaternion a second time.
  setFree(value){
    value=!!value;if(value===this.free)return;
    if(value)this.quaternion=multiplyQuaternion([0,Math.sin(this.yaw/2),0,Math.cos(this.yaw/2)],[Math.sin(this.pitch/2),0,0,Math.cos(this.pitch/2)]);
    else{const f=this.basis().forward;this.yaw=Math.atan2(f[0],f[2]);this.pitch=Math.max(-Math.PI/2+.001,Math.min(Math.PI/2-.001,-Math.asin(Math.max(-1,Math.min(1,f[1])))));}
    this.free=value;
  }
  basis(){return quaternionBasis(this.quaternion);}
  applyCamera(B,camera){
    if(this.free){camera.updateUpVectorFromRotation=true;camera.noRotationConstraint=true;if(!camera.rotationQuaternion)camera.rotationQuaternion=new B.Quaternion();camera.rotationQuaternion.set(...this.quaternion);}
    else{camera.updateUpVectorFromRotation=false;camera.noRotationConstraint=false;camera.upVector.set(0,1,0);camera.rotationQuaternion=null;camera.rotation.set(this.pitch,this.yaw,0);}
  }
  frame(dt=0,roll=0){
    // Preserve legitimate rapid turns and all normal packets, with no smoothing,
    // per-frame speed cap, delayed replay or frame-rate-dependent sensitivity.
    if(this.free){
      // Local yaw + local pitch: no global-up constraint or pole singularity.
      const x=this.pendingX,y=this.pendingY;
      this.quaternion=multiplyQuaternion(multiplyQuaternion(this.quaternion,[0,Math.sin(x/2),0,Math.cos(x/2)]),[Math.sin(y/2),0,0,Math.cos(y/2)]);
      // Positive local-Z roll moves the head toward the astronaut's left.
      // Integrate held input once per simulation frame, independent of key repeat.
      const angle=Number.isFinite(dt)&&Number.isFinite(roll)?Math.max(0,dt)*Math.max(-1,Math.min(1,roll))*Math.PI/3:0;
      this.quaternion=multiplyQuaternion(this.quaternion,[0,0,Math.sin(angle/2),Math.cos(angle/2)]);
      const n=Math.hypot(...this.quaternion);this.quaternion=this.quaternion.map(v=>v/n);
    }else{this.yaw+=this.pendingX;this.pitch=Math.max(-Math.PI/2+.001,Math.min(Math.PI/2-.001,this.pitch+this.pendingY));}
    this.pendingX=0;this.pendingY=0;return {yaw:this.yaw,pitch:this.pitch};
  }
}

export function multiplyQuaternion(a,b){const [x,y,z,w]=a,[X,Y,Z,W]=b;return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];}
export function quaternionBasis(q){const [x,y,z,w]=q;return {right:[1-2*(y*y+z*z),2*(x*y+w*z),2*(x*z-w*y)],up:[2*(x*y-w*z),1-2*(x*x+z*z),2*(y*z+w*x)],forward:[2*(x*z+w*y),2*(y*z-w*x),1-2*(x*x+y*y)]};}
