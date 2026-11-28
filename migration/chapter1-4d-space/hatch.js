import {WALK_CENTER_Z,SIDE_WINDOW_CENTER_Z,WALK_THRESHOLD_TOP_Z} from './room-dimensions.js';
export {WALK_CENTER_Z} from './room-dimensions.js';
import {H,cellId,canonicalFrame,worldToTangent,axisOf,normalFor} from './chapter-topology.js';
export const ROUND_RADIUS=1.075, WALK_RADIUS=1.325, THRESHOLD_HALF=.75;
export const walkDoor=(n,v,mode)=>mode==='upper'&&[0,3].includes(axisOf(n))&&[0,3].includes(axisOf(v));
function walkPoint(y,z,r){return Math.hypot(y,z-WALK_CENTER_Z)<=WALK_RADIUS-r+1e-8||(Math.abs(y)<=THRESHOLD_HALF-r+1e-8&&z>=-H+r-1e-8&&z<=WALK_THRESHOLD_TOP_Z+r+1e-8);}
export function insideHatch(n,v,p,mode='lower',r=.2){n=normalFor(n);v=normalFor(v);let a=axisOf(n),b=axisOf(v);if(a===b)return false;if(mode==='upper'){if(!walkDoor(n,v,mode))return false;let foot=Math.max(-H+r,p[2]-1.48);return walkPoint(p[1],p[2],r)&&walkPoint(p[1],foot,r)&&walkPoint(p[1],p[2]+.1,.12);}let q=[0,1,2,3].filter(i=>i!==a&&i!==b).map(i=>p[i]);return Math.hypot(...q)<=ROUND_RADIUS-r+1e-8;}
export function hatchProfile(n,v,mode='upper'){let frame=canonicalFrame(n),out=worldToTangent(frame,v),axis=out.findIndex(x=>Math.abs(x)>.5),other=[0,1,2].filter(i=>i!==axis),walk=walkDoor(n,v,mode),bounds=other.map(()=>[-ROUND_RADIUS,ROUND_RADIUS]);if(walk)for(let j=0;j<2;j++){let z=frame[other[j]][2];bounds[j]=z===1?[-H,WALK_CENTER_Z+WALK_RADIUS]:z===-1?[-WALK_CENTER_Z-WALK_RADIUS,H]:[-WALK_RADIUS,WALK_RADIUS];}let center=other.map(k=>mode==='upper'&&!walk?frame[k][2]*SIDE_WINDOW_CENTER_Z:0);if(!walk)bounds.forEach((b,j)=>{b[0]+=center[j];b[1]+=center[j];});return{axis,sign:out[axis],other,bounds,walk,frame,center};}
// Ordered radial outline, with a flat floor threshold for grounded astronauts.
// Wall and rim use this exact outline; the analytic collision is conservative
// by player radius, not the old rectangular opening.
export function hatchOutline(n,v,mode='upper',segments=80){let a=hatchProfile(n,v,mode),points=[],centers=[],angles=Array.from({length:segments},(_,i)=>i*2*Math.PI/segments);if(a.walk)for(let x of [-H,H])for(let y of [-H,H])angles.push((Math.atan2(y-WALK_CENTER_Z,x)+2*Math.PI)%(2*Math.PI));angles.sort((a,b)=>a-b);for(const theta of angles){let dx=Math.cos(theta),dy=Math.sin(theta),r=a.walk?WALK_RADIUS:ROUND_RADIUS,center=[...a.center];if(a.walk){center=[0,WALK_CENTER_Z];if(dy<0){let floorT=(-H-WALK_CENTER_Z)/dy,sideT=Math.abs(dx)>1e-9?THRESHOLD_HALF/Math.abs(dx):Infinity;let exit=Math.min(floorT,sideT),entry=(WALK_THRESHOLD_TOP_Z-WALK_CENTER_Z)/dy;if(exit>=entry&&entry<=r)r=Math.max(r,exit);}}
 let uv=[center[0]+dx*r,center[1]+dy*r],cc=center;if(a.walk){const convert=([y,z])=>a.other.map(k=>a.frame[k][1]*y+a.frame[k][2]*z);uv=convert(uv);cc=convert(center);}points.push(uv);centers.push(cc);}
 return {...a,points,center:centers[0]};}
