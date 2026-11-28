import {hatchProfile} from './hatch.js';
import {ROOM_SIZE} from './room-dimensions.js';
import {H,normalFor,cellId,cellNeighbors,canonicalFrame,worldToTangent,portalTransform,composeTransforms,mapPoint,mapVector,dot,scale} from './chapter-topology.js';
export const APERTURE=1.075;
export const CLEAR_STRAIGHT_ROOMS=10,MAX_STRAIGHT_DEPTH=CLEAR_STRAIGHT_ROOMS+2,MAX_TURN_DEPTH=4,MAX_RENDER_CLIP_PLANES=20;
// All surfaces in the first ten complete rooms remain clear, even from the
// opposite root-room corner; two additional populated rooms supply a guard band.
// Fade to the exact scene background before any finite straight-path edge.
export const OPTICAL_FADE_START=(CLEAR_STRAIGHT_ROOMS+1.25)*ROOM_SIZE,OPTICAL_FADE_END=MAX_STRAIGHT_DEPTH*ROOM_SIZE;
export function opticalDistanceFade(distance){const t=Math.max(0,Math.min(1,(distance-OPTICAL_FADE_START)/(OPTICAL_FADE_END-OPTICAL_FADE_START)));return t*t*(3-2*t);}
export function isLoopCell(n){return ['X','W'].includes(cellId(n)[0]);}
export function aperture(n,v,mode='upper'){
 return hatchProfile(n,v,mode);
}
export function portalQuad(n,v,transform,mode){const {axis,sign,other,bounds}=aperture(n,v,mode);return [[0,0],[1,0],[1,1],[0,1]].map(([a,b])=>{let p=[0,0,0];p[axis]=sign*H;p[other[0]]=bounds[0][a];p[other[1]]=bounds[1][b];return mapPoint(transform,p);});}
// Budget: all six branches through two seams, plus all six straight optical
// paths through four seams. No image is inserted into a nearer cell.
export function buildOpticalInstances(state,mode='upper'){
 const n=state.normal,cf=canonicalFrame(n),rootT={rotation:cf.map(a=>worldToTangent(state.frame,a)),offset:[0,0,0]},root={normal:n,transform:rootT,quads:[],depth:0,path:[cellId(n)]},result=[root];
 const child=(parent,v)=>{let q=portalQuad(parent.normal,v,parent.transform,mode),T=composeTransforms(parent.transform,portalTransform(parent.normal,v));return {normal:v,transform:T,quads:[...parent.quads,q],depth:parent.depth+1,path:[...parent.path,cellId(v)]};};
 for(let first of cellNeighbors(n)){
  const one=child(root,first);result.push(one);let straight;
  for(let second of cellNeighbors(first)){if(dot(second,n)>.5)continue;let two=child(one,second);result.push(two);if(dot(second,scale(n,-1))>.5)straight=two;}
  // Side windows of the second straight-ahead room need actual backing cells,
  // not just a pane that reveals clear background until the next seam.
  for(const side of cellNeighbors(straight.normal)){if(Math.abs(dot(side,first))<.5)result.push(child(straight,side));}
  const three=child(straight,scale(first,-1)),four=child(three,n);result.push(three,four);
 }
 return result;
}
const sub=(a,b)=>a.map((x,i)=>x-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],mean=a=>a[0].map((_,i)=>a.reduce((s,p)=>s+p[i],0)/a.length);
export function clipPlanes(quads,eye){let planes=[];for(const q of quads){let center=mean(q);for(let i=0;i<4;i++){let n=cross(sub(q[i],eye),sub(q[(i+1)%4],eye)),len=Math.hypot(...n);if(len<1e-8){planes.push([0,0,0,1]);continue;}n=n.map(x=>x/len);let d=-dot(n,eye);if(dot(n,center)+d<0){n=n.map(x=>-x);d=-d;}planes.push([...n,d]);}let n=sub(center,eye),len=Math.hypot(...n);n=n.map(x=>x/(len||1)); // only the quad-normal depth plane, not an oblique eye-normal plane
 let normal=cross(sub(q[1],q[0]),sub(q[3],q[0]));len=Math.hypot(...normal);normal=normal.map(x=>x/(len||1));if(dot(normal,n)<0)normal=normal.map(x=>-x);planes.push([...normal,-dot(normal,center)-.002]);}return planes;}
// For equally sized, parallel straight apertures, every intermediate opening is
// the convex interpolation of the first and last. Their endpoint cones exactly
// imply the full chain even for an off-axis eye. Validate in world coordinates,
// not signed-axis charts, so arbitrary orthonormal transported frames also work.
export function canCompactPortalChain(quads,eye){
 if(quads.length<3)return false;
 const first=quads[0],origin=mean(first),normal=cross(sub(first[1],first[0]),sub(first[3],first[0])),length=Math.hypot(...normal);
 if(length<1e-8)return false;
 const axis=normal.map(x=>x/length),initial=dot(axis,sub(origin,eye)),sign=Math.sign(initial);
 if(!sign)return false;
 let previous=0;
 for(const quad of quads){
  const center=mean(quad),delta=sub(center,origin),along=dot(delta,axis);
  if(Math.hypot(...delta.map((x,i)=>x-along*axis[i]))>1e-7)return false;
  if((initial+along)*sign<=0||along*sign<previous-1e-7)return false;
  previous=along*sign;
  if(quad.some(point=>!first.some(corner=>Math.hypot(...point.map((x,i)=>x-along*axis[i]-corner[i]))<1e-7)))return false;
 }
 return true;
}
export function renderClipPlanes(quads,eye){
 const compact=canCompactPortalChain(quads,eye),planes=clipPlanes(compact?[quads[0],quads.at(-1)]:quads,eye);
 // Never silently upload/truncate a longer chain than the fragment shader reads.
 if(planes.length>MAX_RENDER_CLIP_PLANES)throw Error('Optical path exceeds validated shader clipping budget');
 return planes;
}
export function insideClips(point,planes,tolerance=1e-6){return planes.every(p=>dot(p.slice(0,3),point)+p[3]>=-tolerance);}
export function rootSelfTransform(state,instance){const cf=canonicalFrame(state.normal);return composeTransforms(instance.transform,{rotation:state.frame.map(a=>worldToTangent(cf,a)),offset:[0,0,0]});}
