// View-dependent optical paths. Pure geometry: no Babylon objects or scene allocation.
import {H,cellId,cellNeighbors,canonicalFrame,worldToTangent,tangentToWorld,portalTransform,composeTransforms,localPoint,dot} from './chapter-topology.js';
import {portalQuad,clipPlanes,canCompactPortalChain,MAX_STRAIGHT_DEPTH,MAX_TURN_DEPTH} from './optics.js';
import {viewBasis} from './chapter-motion.js';
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const EPS=1e-9;
// A portal is a visibility gateway, not geometry to discard at the camera's
// near plane. At an exact seam its cone would also be singular (z=0). Evaluate
// only those clip cones from 0.1mm inside the owning chart. The real camera,
// movement, wall geometry, and GPU projection near plane are never moved.
// The renderer must use this same point when deriving the selected clip planes.
export function opticalClipEye(eye,state){
 const frame=canonicalFrame(state.normal),local=worldToTangent(frame,tangentToWorld(state.frame,eye)),limit=H-.0001;
 if(local.every(v=>Math.abs(v)<=limit))return eye;
 return worldToTangent(state.frame,tangentToWorld(frame,local.map(v=>Math.max(-limit,Math.min(limit,v)))));
}
export function clipPortalPolygon(polygon,planes){
 let result=polygon;
 for(const p of planes){
  if(!result.length)break;
  const output=[];let a=result[result.length-1],da=p[0]*a[0]+p[1]*a[1]+p[2]*a[2]+p[3];
  for(const b of result){const db=p[0]*b[0]+p[1]*b[1]+p[2]*b[2]+p[3],ina=da>=-EPS,inb=db>=-EPS;
   if(ina!==inb){const t=da/(da-db);output.push(a.map((v,i)=>v+(b[i]-v)*t));}
   if(inb)output.push(b);a=b;da=db;
  }result=output;
 }return result;
}
export function cameraClipPlanes(eye,look={},options={}){
 const basis=viewBasis(look),{right,up,forward}=basis;
 const ty=Math.tan((options.fov??1.16)/2),tx=ty*(options.aspect??4/3);
 const plane=(n,offset=0)=>[...n,-dot(n,eye)-offset];
 const sides=[right.map((v,i)=>forward[i]*tx+v),right.map((v,i)=>forward[i]*tx-v),up.map((v,i)=>forward[i]*ty+v),up.map((v,i)=>forward[i]*ty-v)];
 return {basis,tx,ty,planes:[plane(forward,options.near??.00001),...sides.map(n=>plane(n))]};
}
function projectedArea(poly,eye,camera){
 if(poly.length<3)return 0;
 const points=poly.map(p=>{const v=sub(p,eye),z=dot(v,camera.basis.forward);return [dot(v,camera.basis.right)/(z*camera.tx),dot(v,camera.basis.up)/(z*camera.ty)];});
 let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-a[1]*b[0];}return Math.abs(area)*.5;
}
export function buildVisibleOpticalInstances(state,mode='upper',look={},options={}){
 const limit=Math.max(0,options.maxDepth??MAX_STRAIGHT_DEPTH),maxStraightDepth=Math.min(MAX_STRAIGHT_DEPTH,limit,Math.max(0,options.maxStraightDepth??MAX_STRAIGHT_DEPTH)),maxTurnDepth=Math.min(MAX_TURN_DEPTH,limit,Math.max(0,options.maxTurnDepth??MAX_TURN_DEPTH)),eye=opticalClipEye(localPoint(state),state),camera=cameraClipPlanes(eye,look,options);
 const root={normal:state.normal,transform:{rotation:canonicalFrame(state.normal).map(a=>worldToTangent(state.frame,a)),offset:[0,0,0]},quads:[],depth:0,path:[cellId(state.normal)],visibleArea:4,straight:true,previousNormal:null};root.key=root.path.join('/');
 const candidates=[root];
 const visit=(parent,planes)=>{
  if(parent.depth>=Math.max(maxStraightDepth,maxTurnDepth))return;
  for(const n of cellNeighbors(parent.normal)){
   // Immediate reverse crosses the same seam and cannot reveal a new optical region.
   if(parent.path.length>1&&cellId(n)===parent.path[parent.path.length-2])continue;
   const straight=parent.straight&&(!parent.previousNormal||dot(n,parent.previousNormal)<-.5);
   if(parent.depth>=(straight?maxStraightDepth:maxTurnDepth))continue;
   const quad=portalQuad(parent.normal,n,parent.transform,mode),polygon=clipPortalPolygon(quad,planes),area=projectedArea(polygon,eye,camera);
   if(area<=1e-10)continue;
   const path=[...parent.path,cellId(n)],child={normal:n,transform:composeTransforms(parent.transform,portalTransform(parent.normal,n)),quads:[...parent.quads,quad],depth:parent.depth+1,path,key:path.join('/'),visibleArea:area,straight,previousNormal:parent.normal};
   // If a future hatch/frame change breaks the exact compression invariant,
   // stop the extra straight recursion rather than overflow shader uniforms.
   if(child.depth>MAX_TURN_DEPTH&&!canCompactPortalChain(child.quads,eye))continue;
   candidates.push(child);visit(child,[...planes,...clipPlanes([quad],eye)]);
  }
 };
 visit(root,camera.planes);
 // Reserve visible straight corridors before spending the shared pool on turns.
 // Within each group parents precede children; discarded parents cannot leak shells.
 candidates.sort((a,b)=>Number(b.straight)-Number(a.straight)||a.depth-b.depth||b.visibleArea-a.visibleArea||a.key.localeCompare(b.key));
 const counts=new Map(),selected=[],selectedKeys=new Set(),maxPerCell=Math.min(10,Math.max(1,options.maxPerCell??10)),maxInstances=Math.min(80,Math.max(1,options.maxInstances??80));
 for(const x of candidates){const id=cellId(x.normal),count=counts.get(id)||0;if(count>=maxPerCell||x.depth&&!selectedKeys.has(x.path.slice(0,-1).join('/')))continue;counts.set(id,count+1);selected.push(x);selectedKeys.add(x.key);if(selected.length>=maxInstances)break;}
 return selected.sort((a,b)=>a.depth-b.depth||a.key.localeCompare(b.key));
}
