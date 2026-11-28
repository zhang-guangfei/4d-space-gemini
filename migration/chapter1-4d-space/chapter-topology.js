/** Exact cubical atlas for the boundary of [-H,H]^4.
 * Cell n has n·p=H. A tangent frame contains three orthonormal 4-vectors.
 * Across face v, tangent a is transported by a-(a·v)(v+n).
 * This is the XW/YW/etc quarter-turn fixing the other two axes, not a 3-torus.
 */
import {H} from './room-dimensions.js';
export {H} from './room-dimensions.js';
export const AXES=['X','Y','Z','W'];
export const CELL_IDS=AXES.flatMap(a=>[a+'+',a+'-']);
export const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const add=(a,b)=>a.map((x,i)=>x+b[i]);
export const sub=(a,b)=>a.map((x,i)=>x-b[i]);
export const scale=(a,s)=>a.map(x=>x*s);
export const axisOf=n=>n.findIndex(x=>Math.abs(x)>.5);
export function normalFor(id){if(Array.isArray(id))return [...id];let key=id.replace('−','-').toUpperCase();if(!CELL_IDS.includes(key))throw Error('Unknown cell '+id);let n=[0,0,0,0];n[AXES.indexOf(key[0])]=key[1]==='+'?1:-1;return n;}
export function cellId(n){n=normalFor(n);let a=axisOf(n);return AXES[a]+(n[a]>0?'+':'-');}
export function cellNeighbors(n){n=normalFor(n);return CELL_IDS.map(normalFor).filter(v=>Math.abs(dot(n,v))<.5);}
function determinant4(cols){const p=[0,1,2,3];let sum=0;function rec(a,left){if(!left.length){let inversions=0;for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)if(a[i]>a[j])inversions++;let term=inversions%2?-1:1;for(let i=0;i<4;i++)term*=cols[i][a[i]];sum+=term;return;}for(let k=0;k<left.length;k++)rec([...a,left[k]],left.filter((_,i)=>i!==k));}rec([],p);return sum;}
/** Oriented chart: W+ starts [Y+,Z+,X+]; the whole central XW loop has stable Y/Z. */
export function canonicalFrame(n){n=normalFor(n);let normalAxis=axisOf(n),order=[1,2,0,3].filter(i=>i!==normalAxis);let frame=order.map(i=>{let a=[0,0,0,0];a[i]=1;return a;});if(determinant4([...frame,n])<0)frame[2]=scale(frame[2],-1);return frame;}
export function tangentToWorld(frame,v){return frame.reduce((a,b,i)=>add(a,scale(b,v[i])),[0,0,0,0]);}
export function worldToTangent(frame,a){return frame.map(b=>dot(b,a));}
export function transport(a,n,v){n=normalFor(n);v=normalFor(v);if(Math.abs(dot(n,v))>.5)throw Error('Nonadjacent cell transport');return sub(a,scale(add(v,n),dot(a,v)));}
export function transportFrame(frame,n,v){return frame.map(a=>transport(a,n,v));}
/** Player convention: +Y lies to the LEFT, +Z above and +X forward.
 * This intentionally has opposite handedness to canonical cell charts; the
 * root rendering transform can have determinant -1. Do not silently relabel Y.
 */
export function initialState(){let normal=normalFor('W+');return {normal,p:scale(normal,H),frame:[normalFor('Y-'),normalFor('Z+'),normalFor('X+')]};}
export function copyState(state){return {normal:normalFor(state.normal),p:[...state.p],frame:state.frame.map(a=>[...a])};}
/**
 * Continuous motion in the transported intrinsic frame. No orientation reset.
 * canCross({from,to,p,frame}) can block a boundary; blocked outward motion is
 * removed and tangential motion slides. Geometry uses a point; player-radius
 * door/jamb collision is the owning controller's responsibility.
 * crossing.p is the shared seam point, and from is the return-door normal.
 */
export function advance(state,delta3,{canCross=()=>true,maxCrossings=256}={}){
 let s=copyState(state),remaining=[...delta3],crossings=[],blocked=[],elapsed=0,remainingFraction=1,iterations=0;
 while(Math.hypot(...remaining)>1e-10){
  if(++iterations>maxCrossings+16)throw Error('advance exceeded safe seam iteration bound');
  let d=tangentToWorld(s.frame,remaining),normalAxis=axisOf(s.normal),t=1,face=null;
  for(let i=0;i<4;i++){if(i===normalAxis||Math.abs(d[i])<1e-12)continue;let sign=Math.sign(d[i]),candidate=(sign*H-s.p[i])/d[i];if(candidate>=-1e-9&&candidate<=t+1e-12){if(candidate<t-1e-12||face===null){t=Math.max(0,Math.min(1,candidate));face=[0,0,0,0];face[i]=sign;}}}
  s.p=add(s.p,scale(d,t));s.p[normalAxis]=s.normal[normalAxis]*H;
  elapsed+=remainingFraction*t;remainingFraction*=1-t;remaining=scale(remaining,1-t);
  if(!face)break;
  const seam={from:[...s.normal],to:face,p:[...s.p],frame:s.frame.map(a=>[...a]),fraction:elapsed};
  if(canCross(seam)){
   const before=s.frame;s.frame=transportFrame(s.frame,s.normal,face);s.normal=face;s.p[axisOf(face)]=face[axisOf(face)]*H;
   crossings.push({...seam,frameBefore:before,frameAfter:s.frame.map(a=>[...a])});
   if(crossings.length>maxCrossings)throw Error('advance exceeded maxCrossings');
  }else{
   blocked.push(seam);let outgoing=worldToTangent(s.frame,face),amount=dot(remaining,outgoing);remaining=sub(remaining,scale(outgoing,Math.max(0,amount)));
  }
 }
 return {state:s,crossings,blocked};
}
export const identityTransform=()=>({rotation:[[1,0,0],[0,1,0],[0,0,1]],offset:[0,0,0]});
/** Rotation is stored as three columns. */
export function mapVector(transform,v){return transform.rotation.reduce((out,c,i)=>add(out,scale(c,v[i])),[0,0,0]);}
export function mapPoint(transform,p){return add(transform.offset,mapVector(transform,p));}
export function composeTransforms(outer,inner){return {rotation:inner.rotation.map(c=>mapVector(outer,c)),offset:mapPoint(outer,inner.offset)};}
/** Child canonical local point -> unfolded parent local point.
 * Shared-face center S=H(n+v). Unfold(q)=S+T[v->n](q-S).
 * Therefore the child's center Hv maps to Hn+2Hv (distance 2H),
 * while every point on the shared face stays fixed. It is an isometry.
 */
export function portalTransform(n,v,parentFrame=canonicalFrame(n),childFrame=canonicalFrame(v)){
 n=normalFor(n);v=normalFor(v);if(Math.abs(dot(n,v))>.5)throw Error('Portal must join adjacent cells');
 return {rotation:childFrame.map(a=>worldToTangent(parentFrame,transport(a,v,n))),offset:worldToTangent(parentFrame,scale(v,2*H))};
}
/** nextCells is a list of neighbor cell IDs/normals, excluding starting cell. */
export function unfoldPath(startNormal,nextCells,startFrame=canonicalFrame(startNormal)){
 let normal=normalFor(startNormal),frame=startFrame.map(a=>[...a]),transform=identityTransform();
 for(let id of nextCells){let next=normalFor(id),child=canonicalFrame(next);transform=composeTransforms(transform,portalTransform(normal,next,frame,child));normal=next;frame=child;}
 return {normal,frame,transform,depth:nextCells.length};
}
export function localPoint(state,p=state.p){return worldToTangent(state.frame,sub(p,scale(state.normal,H)));}
