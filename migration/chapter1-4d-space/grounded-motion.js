/** Upper-stage grounded motion. Coordinates are metres; global Z is vertical.
 * Avatar feet stand at the shared room floor. Jump height is FEET displacement, not eye height.
 * The module never rotates the view and never adds camera bob.
 */
export const AVATAR_HEIGHT=1.75;
export const GRAVITY=4.905;
export const STANDING_EYE=1.68;
export const CROUCH_EYE=1.15;
import {FLOOR_Z,CEILING_Z} from './room-dimensions.js';
export {FLOOR_Z,CEILING_Z} from './room-dimensions.js';
export const CROWN_ABOVE_EYE=.20;
export const JUMP_SPEED=Math.sqrt(2*GRAVITY*AVATAR_HEIGHT);
const EPS=1e-10;
const MAX_FOOT_LIFT=CEILING_Z-CROWN_ABOVE_EYE-STANDING_EYE-FLOOR_Z;

export class GroundMotion {
 constructor(){this.reset();}
 reset({footLift=0,verticalVelocity=0,crouched=false}={}){
  this.footLift=Math.max(0,Math.min(MAX_FOOT_LIFT,footLift));
  this.verticalVelocity=verticalVelocity;
  this.airborne=this.footLift>EPS||verticalVelocity>EPS;
  if(!this.airborne)this.verticalVelocity=0;
  this.releaseJumpControl();this.peakFootLift=this.footLift;
  this.eyeZ=FLOOR_Z+this.footLift+(this.airborne?STANDING_EYE:crouched?CROUCH_EYE:STANDING_EYE);
  return this;
 }
 /** Release/pause/lock loss disarms the pack without changing height or velocity.
  * Only the next grounded launch may arm it again: no midair boost/double jump. */
 releaseJumpControl(){this.jumpHeld=false;this.jetpackArmed=false;this.hovering=false;return this;}
 /** jumpPressed accepts the owning controller's edge queue. A held true value
  * is also guarded here, so browser key repeat cannot auto-bounce after landing.
  * Crouch is grounded-only; launching from crouch stands the avatar immediately.
  */
 step(dt,jumpPressed=false,crouched=false,jetpackHeld=false){
  if(!Number.isFinite(dt)||dt<0)throw Error('GroundMotion dt must be finite and nonnegative');
  const oldLift=this.footLift,wasAirborne=this.airborne;
  const edge=Boolean(jumpPressed)&&!this.jumpHeld;this.jumpHeld=Boolean(jumpPressed);
  let jumped=false,landed=false;
  if(!jetpackHeld){this.jetpackArmed=false;this.hovering=false;}
  if(edge&&!this.airborne){this.verticalVelocity=JUMP_SPEED;this.airborne=true;this.peakFootLift=this.footLift;this.jetpackArmed=Boolean(jetpackHeld);this.hovering=false;jumped=true;}
  let left=dt,iterations=0;
  while(this.airborne&&left>EPS){
   if(++iterations>6)throw Error('Unexpected grounded-motion event loop');
   let f=this.footLift,v=this.verticalVelocity;
   if(f>=MAX_FOOT_LIFT-EPS&&v>0){f=MAX_FOOT_LIFT;v=0;this.footLift=f;this.verticalVelocity=v;}
   // Hover balances gravity only after ascent ends; it never adds another
   // upward impulse. Contact with a low ceiling/lintel becomes a lower apex.
   if(this.jetpackArmed&&v<=EPS){this.verticalVelocity=0;this.hovering=true;break;}
   // Positive floor root of f+v*t-g*t²/2=0. This also handles long frames
   // crossing the apex and landing without an Euler integration error.
   const floorTime=(v+Math.sqrt(Math.max(0,v*v+2*GRAVITY*f)))/GRAVITY;
   let event='none',duration=left;
   if(floorTime>=-EPS&&floorTime<=duration+EPS){duration=Math.max(0,floorTime);event='floor';}
   const gap=MAX_FOOT_LIFT-f,disc=v*v-2*GRAVITY*gap;
   if(v>0&&disc>=0){const ceilingTime=(v-Math.sqrt(disc))/GRAVITY;if(ceilingTime>=-EPS&&ceilingTime<=duration+EPS){duration=Math.max(0,ceilingTime);event='ceiling';}}
   const apexTime=v/GRAVITY;
   if(this.jetpackArmed&&apexTime>=0&&apexTime<=duration+EPS){duration=Math.max(0,apexTime);event='hover';}
   if(apexTime>=0&&apexTime<=duration)this.peakFootLift=Math.max(this.peakFootLift,Math.min(MAX_FOOT_LIFT,f+v*v/(2*GRAVITY)));
   this.footLift=f+v*duration-.5*GRAVITY*duration*duration;
   this.verticalVelocity=v-GRAVITY*duration;
   this.peakFootLift=Math.max(this.peakFootLift,Math.min(MAX_FOOT_LIFT,this.footLift));
   left=Math.max(0,left-duration);
   if(event==='floor'){this.footLift=0;this.verticalVelocity=0;this.airborne=false;this.jetpackArmed=false;this.hovering=false;landed=true;}
   else if(event==='ceiling'){this.footLift=MAX_FOOT_LIFT;this.verticalVelocity=0;}
   else if(event==='hover'){this.verticalVelocity=0;this.hovering=true;break;}
   else break;
  }
  this.eyeZ=FLOOR_Z+this.footLift+(this.airborne?STANDING_EYE:crouched?CROUCH_EYE:STANDING_EYE);
  return {eyeZ:this.eyeZ,verticalVelocity:this.verticalVelocity,airborne:this.airborne,hovering:this.hovering,jetpackArmed:this.jetpackArmed,footLift:this.footLift,localYdelta:this.footLift-oldLift,landed,jumped,wasAirborne};
 }
}

/** Distance-driven leg pose only. Caller must pass actual collision-resolved
 * ground travel, not requested velocity/key intent. No view/head offset exists.
 */
export class GroundGait {
 constructor(){this.reset();}
 reset(){this.phase=0;this.leftLeg=0;this.rightLeg=0;return this;}
 step(distanceTravel,dt,speed=0,airborne=false,zeroG=false){
  if(!Number.isFinite(dt)||dt<0||!Number.isFinite(distanceTravel)||!Number.isFinite(speed))throw Error('Invalid gait input');
  if(zeroG){this.leftLeg=0;this.rightLeg=0;}
  else if(airborne){this.leftLeg=-.28;this.rightLeg=.28;}
  else if(Math.abs(distanceTravel)>1e-7){
   this.phase=(this.phase+Math.abs(distanceTravel)*4.2)%(Math.PI*2);
   const amplitude=.38*Math.min(1,Math.abs(speed)/3.2);
   this.leftLeg=Math.sin(this.phase)*amplitude;this.rightLeg=-this.leftLeg;
  }else{
   const decay=Math.exp(-12*dt);this.leftLeg*=decay;this.rightLeg*=decay;
   if(Math.abs(this.leftLeg)<1e-7)this.leftLeg=0;if(Math.abs(this.rightLeg)<1e-7)this.rightLeg=0;
  }
  return {leftLeg:this.leftLeg,rightLeg:this.rightLeg};
 }
}
