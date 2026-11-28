import {H,normalFor,canonicalFrame,worldToTangent,sub,tangentToWorld,scale,dot} from './chapter-topology.js';
import {STATUE_ASSETS} from './classical-statues.js';
export const STATUE_BOUNDS=Object.fromEntries(Object.entries(STATUE_ASSETS).map(([k,v])=>[k,v.bounds]));
// Historical kind names retain the fixed A/B cell identity; each now uses the approved semantic palette.
export const STATUE_COLORS={bronze:'#dedbd2',stone:'#deddd8'};
export function statuePlacement(cell,mode='upper'){
 const n=normalFor(cell);if(Math.abs(n[1])!==1)return null;
 const frame=canonicalFrame(n),up=worldToTangent(frame,[0,0,1,0]),forward=worldToTangent(frame,[1,0,0,0]),right=[up[1]*forward[2]-up[2]*forward[1],up[2]*forward[0]-up[0]*forward[2],up[0]*forward[1]-up[1]*forward[0]],axes=[right,up,forward];
 // The upper observation keeps the approved floor pose. In zeroG place the
 // geometric bounds center (not the feet/pivot) exactly at the room center.
 const kind=n[1]>0?'bronze':'stone',bounds=STATUE_BOUNDS[kind],center=bounds.min.map((v,k)=>(v+bounds.max[k])/2),origin=mode==='lower'?[0,1,2].map(k=>-axes.reduce((sum,a,i)=>sum+a[k]*center[i],0)):up.map(v=>-H*v);
 return {kind,bounds,origin,axes,frame};
}
function statueContact(normal,p,radius,mode){
 const placement=statuePlacement(normal,mode);if(!placement)return null;
 const local=worldToTangent(placement.frame,sub(p,scale(normalFor(normal),H))),delta=sub(local,placement.origin),point=placement.axes.map(a=>dot(a,delta)),min=placement.bounds.min.map(v=>v-radius),max=placement.bounds.max.map(v=>v+radius);
 return point.every((x,k)=>x>min[k]&&x<max[k])?{placement,point,min,max}:null;
}
export function statueBlocked(normal,p,radius=.2,mode='upper'){return !!statueContact(normal,p,radius,mode);}
/** Minimum-translation candidates for a pre-existing overlap. Retain the
 * conservative expanded bounds proxy; do not disable the physical statue. */
export function statueSeparations(normal,p,radius=.2,mode='upper',epsilon=1e-6){
 const contact=statueContact(normal,p,radius,mode);if(!contact)return [];
 const {placement,point,min,max}=contact,out=[];
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const normal4=tangentToWorld(placement.frame,scale(placement.axes[axis],sign)),distance=sign*((sign<0?min[axis]-epsilon:max[axis]+epsilon)-point[axis]);
  out.push({normal:normal4,delta:scale(normal4,distance),distance});
 }
 return out.sort((a,b)=>a.distance-b.distance);
}
