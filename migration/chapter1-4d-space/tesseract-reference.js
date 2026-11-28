/** Verified reverse-reference preview mathematics. Game room IDs remain XYZW.
 * Preview coordinates are [gameX,gameZ,gameY,gameW]; Babylon LH reflects preview Z.
 * Estimated from the reference, not original-author parameters. Model fit RMSE 2.68px/256.
 */
export const REFERENCE_PARAMS=Object.freeze({d4:3.0543863938108604,s:2.0543863938108604,R:5.59170353355185,f:345.7017708210825,az:.5536725699521114,el:.3399068001961633,roll:-.030779686432092664,cx:125.50474595434497,cy:127.13085490714941,omega:Math.PI/6.72,rodRadius:.035,statueScale:.325,observerScale:.294,period:13.44});
const P=REFERENCE_PARAMS;
export const gameToReference=v=>[v[0],v[2],v[1],v[3]];
export const referenceToEngine=v=>[v[0],v[1],-v[2]];
export function referenceRotate(v,angle){const c=Math.cos(angle),s=Math.sin(angle);return [c*v[0]-s*v[3],v[1],v[2],s*v[0]+c*v[3]];}
export const reverseReferenceAngle=seconds=>-P.omega*seconds;
export function projectReference4(v){const k=P.s/(P.d4-v[3]);return [v[0]*k,v[1]*k,v[2]*k];}
export const projectGameToRef=(v,angle=0)=>projectReference4(referenceRotate(gameToReference(v),angle));
export const projectGameToEngine=(v,angle=0)=>referenceToEngine(projectGameToRef(v,angle));
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
export const REFERENCE_CAMERA=(()=>{const {az,el,roll,R}=P,c=[Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)],r=[Math.cos(az),0,-Math.sin(az)],u=[-Math.sin(az)*Math.sin(el),Math.cos(el),-Math.cos(az)*Math.sin(el)],rr=r.map((v,i)=>Math.cos(roll)*v+Math.sin(roll)*u[i]),uu=u.map((v,i)=>Math.cos(roll)*v-Math.sin(roll)*r[i]);return Object.freeze({previewPosition:c.map(x=>x*R),enginePosition:referenceToEngine(c.map(x=>x*R)),engineUp:referenceToEngine(uu),engineRight:referenceToEngine(rr),previewRight:r,previewUp:u,previewViewOut:c,verticalFov:2*Math.atan(128/P.f),principalPoint:[P.cx/256,P.cy/256]});})();
/** Gold-standard screen oracle, y down, original 256x256 canvas (scale as needed). */
export function referenceScreen(v){const x=P.f*dot(REFERENCE_CAMERA.previewRight,v)/(P.R-dot(REFERENCE_CAMERA.previewViewOut,v)),y=-P.f*dot(REFERENCE_CAMERA.previewUp,v)/(P.R-dot(REFERENCE_CAMERA.previewViewOut,v)),c=Math.cos(P.roll),s=Math.sin(P.roll);return [P.cx+c*x-s*y,P.cy+s*x+c*y];}
/** True piecewise projected inner-floor envelope; no discrete nearest-cell switch. */
export function innerFloorAtX(x,angle){const c=Math.cos(angle),s=Math.sin(angle),ys=[];for(const [A,B] of [[-s,c],[c,s]])if(Math.abs(B)>1e-10)ys.push((B*P.s-A*x)/(-Math.sign(B)-B*P.d4));return Math.min(...ys);}
/** Input batches are already scaled 3D actor positions, preview OR engine (same x/y).
 * One common vertical translation grounds the supporting sole without flattening swing feet.
 * The centered display actor is not claimed to remain in one physical 4D cell.
 */
export function groundObserverPositions(batches,angle){let gap=Infinity;for(const a of batches)for(let i=0;i<a.length;i+=3)gap=Math.min(gap,a[i+1]-innerFloorAtX(a[i],angle));if(!Number.isFinite(gap))return 0;for(const a of batches)for(let i=1;i<a.length;i+=3)a[i]-=gap;return -gap;}
export function statueSourceBounds(positions){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<positions.length;i+=3)for(let k=0;k<3;k++){min[k]=Math.min(min[k],positions[i+k]);max[k]=Math.max(max[k],positions[i+k]);}return {min,max};}
/** sign +1 = game Y+ Venus, -1 = game Y- David. Actual per-vertex 4D embedding.
 * Source height~2 -> local height~.65; support point minY -> floor -1.
 */
export function statueLocal4(v,bounds,sign){const sc=P.statueScale,u=(v[0]-(bounds.min[0]+bounds.max[0])/2)*sc,y=(v[1]-bounds.min[1])*sc-1,d=(v[2]-(bounds.min[2]+bounds.max[2])/2)*sc;return [sign*u,y,sign,sign*d];}
export function projectStatueVertex(v,bounds,sign,angle){return referenceToEngine(projectReference4(referenceRotate(statueLocal4(v,bounds,sign),angle)));}
/** Correct inverse-transpose normal including the opposite-cell and LH reflection parity. */
export function projectStatueNormal(v,n,bounds,sign,angle){const q=referenceRotate(statueLocal4(v,bounds,sign),angle),den=P.d4-q[3],k=P.s/den,sc=P.statueScale;const cols=[[sign*sc,0,0,0],[0,sc,0,0],[0,0,0,sign*sc]].map(a=>{const r=referenceRotate(a,angle);return referenceToEngine([0,1,2].map(j=>k*(r[j]+q[j]*r[3]/den)));});const c0=cross(cols[1],cols[2]),c1=cross(cols[2],cols[0]),c2=cross(cols[0],cols[1]),det=dot(cols[0],c0);return norm([0,1,2].map(j=>(c0[j]*n[0]+c1[j]*n[1]+c2[j]*n[2])/(Math.abs(det)>1e-15?det:1)));}

const GAME_PLANE_MAP=Object.freeze({X:0,Y:2,Z:1,W:3}),statueCache=new WeakMap();
/** Cached 4D anchors; no per-vertex allocation in the frame updater. */
export function prepareStatueProjection(source,kind){const sign=(kind===1||kind==='bronze'||kind==='venus'||kind==='Y+')?1:(kind===-1||kind==='stone'||kind==='david'||kind==='Y-')?-1:0;if(!sign)throw new RangeError('Unknown statue '+kind);let m=statueCache.get(source);if(!m){m=new Map();statueCache.set(source,m);}if(m.has(sign))return m.get(sign);const bounds=statueSourceBounds(source.positions),count=source.positions.length/3,anchor4=new Float64Array(count*4);for(let i=0;i<count;i++){const j=i*3,k=i*4;anchor4[k]=sign*(source.positions[j]-(bounds.min[0]+bounds.max[0])/2)*P.statueScale;anchor4[k+1]=(source.positions[j+1]-bounds.min[1])*P.statueScale-1;anchor4[k+2]=sign;anchor4[k+3]=sign*(source.positions[j+2]-(bounds.min[2]+bounds.max[2])/2)*P.statueScale;}const cache={sign,count,anchor4,normals:source.normals,v:new Float64Array(4),cols:new Float64Array(12),j:new Float64Array(9),lastPositions:new Float32Array(count*3),lastNormals:new Float32Array(count*3),lastAngle:NaN,lastPlane:null};m.set(sign,cache);return cache;}
/** Writes Babylon-LH positions and outward normals. Canonical plane uses game XYZW.
 * If plane differs from XW, only statue projection is generalized: caller must
 * separately choose a meaningful observer grounding policy for that mode.
 */
export function updateStatueBuffers(source,kind,angle,plane='XW',outPos,outNormal){
 const cache=prepareStatueProjection(source,kind),{count,sign,anchor4,normals}=cache;if(!outPos||outPos.length<count*3||!outNormal||outNormal.length<count*3)throw new RangeError('Allocate output buffers once, with 3 floats per vertex');
 if(cache.lastAngle===angle&&cache.lastPlane===plane){outPos.set(cache.lastPositions);outNormal.set(cache.lastNormals);return;}const map=GAME_PLANE_MAP,a=map[plane[0]],b=map[plane[1]];if(a===undefined||b===undefined||a===b||plane.length!==2)throw new RangeError('Invalid plane');const c=Math.cos(angle),s=Math.sin(angle),v=cache.v,cols=cache.cols,j=cache.j;cols.fill(0);cols[0]=sign*P.statueScale;cols[5]=P.statueScale;cols[11]=sign*P.statueScale;
 for(let col=0;col<3;col++){const o=col*4,x=cols[o+a],w=cols[o+b];cols[o+a]=c*x-s*w;cols[o+b]=s*x+c*w;}
 for(let i=0;i<count;i++){
  const k=i*4,o=i*3;v[0]=anchor4[k];v[1]=anchor4[k+1];v[2]=anchor4[k+2];v[3]=anchor4[k+3];const x=v[a],w=v[b];v[a]=c*x-s*w;v[b]=s*x+c*w;const den=P.d4-v[3],scale=P.s/den;outPos[o]=v[0]*scale;outPos[o+1]=v[1]*scale;outPos[o+2]=-v[2]*scale;
  for(let col=0;col<3;col++)for(let row=0;row<3;row++)j[col*3+row]=(row===2?-1:1)*scale*(cols[col*4+row]+v[row]*cols[col*4+3]/den);
  const c00=j[4]*j[8]-j[5]*j[7],c01=j[5]*j[6]-j[3]*j[8],c02=j[3]*j[7]-j[4]*j[6],c10=j[7]*j[2]-j[8]*j[1],c11=j[8]*j[0]-j[6]*j[2],c12=j[6]*j[1]-j[7]*j[0],c20=j[1]*j[5]-j[2]*j[4],c21=j[2]*j[3]-j[0]*j[5],c22=j[0]*j[4]-j[1]*j[3];
  const n0=normals[o],n1=normals[o+1],n2=normals[o+2],nx=c00*n0+c10*n1+c20*n2,ny=c01*n0+c11*n1+c21*n2,nz=c02*n0+c12*n1+c22*n2,det=j[0]*c00+j[1]*c01+j[2]*c02,len=Math.hypot(nx,ny,nz)||1,factor=(det<0?-1:1)/len;outNormal[o]=nx*factor;outNormal[o+1]=ny*factor;outNormal[o+2]=nz*factor;
 }
 cache.lastPositions.set(outPos);cache.lastNormals.set(outNormal);cache.lastAngle=angle;cache.lastPlane=plane;
}
