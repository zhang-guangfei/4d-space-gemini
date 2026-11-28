import {createSoftStatueMaterial} from './statue-lighting.js';
import {SUIT_PARTS,SUIT_JOINTS} from './astronaut.js';
import {statueData,STATUE_ASSETS} from './classical-statues.js';
import {prepareStatueProjection,updateStatueBuffers} from './tesseract-reference.js';
import {createStatuePalette} from './statue-palette.js';
/** Original exact hypercube combinatorics; no external geometry/code copied.
 * Coordinates are [X,Y,Z,W]. IDs use station-compatible trailing signs.
 * Projection is 4D perspective to 3D, then the application's 3D camera to screen.
 */
export const AXES=Object.freeze(['X','Y','Z','W']);
export const CELL_IDS=Object.freeze(['W+','W-','X+','X-','Y+','Y-','Z+','Z-']);
export const CELL_COLORS=Object.freeze({'W+':'#ffffff','W-':'#ffd500','X+':'#ed3036','X-':'#ff8b20','Y+':'#2878ef','Y-':'#25be59','Z+':'#a867e8','Z-':'#26dce5'});
export const MODEL_PROJECTION_DISTANCE=3.0543863938108604;
export const REFERENCE_OMEGA=Math.PI/6.72;
// Reference normalization keeps the initial outer cube at side2.
export const projectionDisplayScale=distance=>(distance-1)/distance;
export const PROJECTION_LABEL='八胞体的三维投影；32条共用边；中央人物是步行参照，两侧雕像随Y±房间投影。';
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const vertices=Array.from({length:16},(_,i)=>AXES.map((_,a)=>(i>>a&1)?1:-1));
const edges=[];for(let i=0;i<16;i++)for(let a=0;a<4;a++){const j=i^(1<<a);if(i<j)edges.push([i,j]);}
const faces=[];for(let a=0;a<4;a++)for(let b=a+1;b<4;b++){const fixed=[0,1,2,3].filter(k=>k!==a&&k!==b);for(let mask=0;mask<4;mask++){let v=0;fixed.forEach((k,j)=>{if(mask>>j&1)v|=1<<k;});faces.push([v,v^(1<<a),v^(1<<a)^(1<<b),v^(1<<b)]);}}
const cells=CELL_IDS.map(id=>{const axis=AXES.indexOf(id[0]),sign=id[1]==='+'?1:-1,vi=vertices.flatMap((v,i)=>v[axis]===sign?[i]:[]),has=new Set(vi);return {id,axis,sign,color:CELL_COLORS[id],vertices:vi,edges:edges.filter(e=>e.every(i=>has.has(i))),faces:faces.filter(f=>f.every(i=>has.has(i))),neighbors:CELL_IDS.filter(other=>other[0]!==id[0]),opposite:id[0]+(sign===1?'-':'+')};});
export const TESSERACT=freeze({vertices,edges,faces,cells});
// Fixed room identities, never selection-relative or camera-left/right.
export const MODEL_FIGURES=freeze([
 {id:'player',cellId:null,kind:'player'},
 {id:'statue-A',cellId:'Y+',kind:'statue',paletteKind:'bronze',variant:'A'},
 {id:'statue-B',cellId:'Y-',kind:'statue',paletteKind:'stone',variant:'B'}
]);
export function canonicalCell(id){const s=String(id).toUpperCase().replace('−','-');const n=/^[+-][WXYZ]$/.test(s)?s[1]+s[0]:s;if(!CELL_IDS.includes(n))throw new RangeError('Unknown cell '+id);return n;}
export function rotate4(point,plane='XW',angle=0){const [a,b]=String(plane).toUpperCase().split('').map(x=>AXES.indexOf(x));if(a<0||b<0||a===b||String(plane).length!==2||!Number.isFinite(angle))throw new RangeError('Invalid 4D rotation');const p=[...point],c=Math.cos(angle),s=Math.sin(angle);p[a]=c*point[a]-s*point[b];p[b]=s*point[a]+c*point[b];return p;}
export function project4(point,distance=4){if(!Number.isFinite(distance)||distance<=2)throw new RangeError('Projection distance must exceed 4D vertex radius 2');const k=distance/(distance-point[3]);return point.slice(0,3).map(v=>v*k);}
export function modelState(options={}){const selected=canonicalCell(options.selected??'W+'),plane=options.plane??'XW',angle=options.angle??0;rotate4([0,0,0,0],plane,angle);return Object.freeze({selected,plane,angle,distance:options.distance??MODEL_PROJECTION_DISTANCE});}
/** Pure descriptors. Exact adjacency never comes from projected overlap.
 * inset=0.94 is illustrative only; selected faces and neutral edges remain exact.
 */
export function modelGeometry(options={}){const state=modelState(options),project=p=>(()=>{const q=project4(rotate4(p,state.plane,state.angle),state.distance).map(x=>x*projectionDisplayScale(state.distance));return [q[0],q[2],-q[1]];})(),points=vertices.map(project),selected=cells.find(c=>c.id===state.selected);return {state,points,edges:edges.map(e=>e.map(i=>points[i])),cells:cells.map((cell,index)=>{const center=[0,0,0,0];center[cell.axis]=cell.sign;const inset=vertices.map(p=>p.map((v,a)=>center[a]+(v-center[a])*.94));const role=cell.id===state.selected?'selected':cell.id===selected.opposite?'opposite':'neighbor';// External label rails avoid W± center overlap. Leaders indicate projected cell centers.
 const labelPosition=[index%2===0?-2.4:2.4,1.8-Math.floor(index/2)*1.2,0];
 return {id:cell.id,color:cell.color,role,alpha:role==='opposite'?.09:role==='selected'?.56:.23,center:project(center),labelPosition,lines:cell.edges.map(e=>e.map(i=>project(inset[i]))),faces:cell.faces.map(f=>f.map(i=>points[i]))};})};}

export const TESSERACT_STYLE=Object.freeze({edgeRadius:.035,outlineRadius:0,edgeAlpha:1,fillAlpha:.10,fillColor:'#91b2bd',emissive:.025});
const subtract=(a,b)=>a.map((x,i)=>x-b[i]),dot3=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],normalize=(a,fallback)=>{const n=Math.hypot(...a);return n>1e-10?a.map(x=>x/n):fallback;};
/** Rendering helper for inspector OR miniature. Host may override ALL material types
 * via materialFactory(spec, scene) for portal clipping. Statue specs include
 * texture/paletteKind/variant; paletteFactory(kind, scene) can lend host textures.
 * Custom materials and borrowed palettes remain host-owned. No canvas, game state or camera is touched.
 */
export function createColoredTesseract(B,scene,options={}){
 const root=new B.TransformNode('colored tesseract',scene),meshes=[],owned=[],textures=[],materials=new Map();root.parent=options.parent??null;root.scaling.setAll(options.scale??1);root.metadata={model:'colored-tesseract',noPedestal:true,projection:PROJECTION_LABEL};let state=modelState(options),disposed=false;
 const mat=(key,spec)=>{if(materials.has(key))return materials.get(key);let m=options.materialFactory?.(spec,scene);if(!m&&spec.kind==='statue'){m=createSoftStatueMaterial(B,scene,'tesseract '+key,spec.texture);owned.push(m);}if(!m){m=new B.StandardMaterial('tesseract '+key,scene);m.diffuseColor=B.Color3.FromHexString(spec.color);m.emissiveColor=m.diffuseColor.scale(.025);m.specularColor=new B.Color3(.22,.22,.22);m.specularPower=32;if(spec.category==='shared-face'){m.twoSidedLighting=true;m.emissiveColor=m.diffuseColor.scale(.18);m.specularColor.set(.08,.08,.08);}m.alpha=spec.alpha;m.backFaceCulling=false;m.disableDepthWrite=spec.alpha<1;if(spec.texture)m.diffuseTexture=spec.texture;owned.push(m);}materials.set(key,m);return m;};
 const mesh=(name,positions,normals,indices,uvs,spec)=>{const m=new B.Mesh(name,scene),d=new B.VertexData();Object.assign(d,{positions,normals,indices,uvs:uvs||new Float32Array(positions.length/3*2)});d.applyToMesh(m,true);m.parent=root;m.material=mat(spec.category==='shared-face'?'cell fill '+spec.cellId:name,spec);m.metadata={...spec,model:'colored-tesseract'};m.isPickable=false;meshes.push(m);return m;};
 const upload=(m,p,n)=>{m.updateVerticesData(B.VertexBuffer.PositionKind,p,false,false);m.updateVerticesData(B.VertexBuffer.NormalKind,n,false,false);m.refreshBoundingInfo();};
 const points=Array.from({length:16},()=>[0,0,0]);
 const project=(v,out)=>{const r=rotate4(v,state.plane,state.angle),k=(state.distance-1)/(state.distance-r[3]);out[0]=r[0]*k;out[1]=r[2]*k;out[2]=-r[1]*k;return out;};
 // One indexed cylinder for each of the32trueedges. No duplicate cell outlines.
 const sides=16,rv=2*sides+2,ep=new Float32Array(32*rv*3),en=new Float32Array(ep.length),ei=[];
 for(let e=0;e<32;e++){const b=e*rv;for(let j=0;j<sides;j++){const k=(j+1)%sides;ei.push(b+j,b+k,b+sides+j,b+k,b+sides+k,b+sides+j,b+2*sides,b+k,b+j,b+2*sides+1,b+sides+j,b+sides+k);}}
 const rods=mesh('exact edges',ep,en,ei,null,{kind:'edge',category:'exact-edge',cellId:null,color:'#4174c8',alpha:1,edgeCount:32,radius:.035});
 const fillMaterials=Object.fromEntries(CELL_IDS.map(id=>[id,mat('cell fill '+id,{kind:'selected-fill',category:'shared-face',cellId:id,color:CELL_COLORS[id],alpha:TESSERACT_STYLE.fillAlpha})]));
 // One neutral pane per shared square. Selection changes tint, never coverage/opacity.
 const neutralFill=mat('cell fill neutral',{kind:'selected-fill',category:'shared-face',cellId:null,color:TESSERACT_STYLE.fillColor,alpha:TESSERACT_STYLE.fillAlpha});
 const fills=faces.map((face,i)=>{const owners=cells.filter(c=>c.faces.includes(face));const fp=new Float32Array(12),fn=new Float32Array(12),fi=[0,1,2,0,2,3],m=mesh('shared face '+i,fp,fn,fi,null,{kind:'selected-fill',category:'shared-face',cellIds:owners.map(c=>c.id),color:CELL_COLORS[owners[0].id],cellId:owners[0].id,alpha:TESSERACT_STYLE.fillAlpha});return {face,owners,fp,fn,fi,m};});
 const figures=[];
 for(const f of MODEL_FIGURES.filter(f=>f.kind==='statue')){const source=statueData(f.paletteKind,'low'),sp=new Float32Array(source.positions.length),sn=new Float32Array(sp.length);let texture=options.paletteFactory?.(f.paletteKind,scene);if(!texture){texture=createStatuePalette(B,scene,f.paletteKind);textures.push(texture);}const m=mesh('tesseract '+f.id,sp,sn,source.indices,source.uvs,{kind:'statue',category:'cell-statue',figureId:f.id,cellId:f.cellId,paletteKind:f.paletteKind,variant:f.variant,statueKind:f.paletteKind,lod:'low',color:'#ffffff',alpha:1,texture});const bounds=STATUE_ASSETS[f.paletteKind].bounds,center=bounds.min.map((x,i)=>(x+bounds.max[i])/2);prepareStatueProjection(source,f.paletteKind);figures.push({f,source,sp,sn,m,center,minY:bounds.min[1],sign:f.cellId==='Y+'?1:-1});}
 // Compile body parts once into three reusable indexed batches; vertices keep
 // their joint identities for walking, not a billboard or an always-on-top pass.
 const buckets=Object.fromEntries(['suit','detail','accent'].map(k=>[k,{p:[],n:[],i:[],records:[]}]));
 for(const part of SUIT_PARTS){const key=part.material==='suit'?'suit':['left','right'].includes(part.material)?'accent':'detail',bucket=buckets[key],g=part.shape==='box'?B.VertexData.CreateBox({width:part.size[0],height:part.size[1],depth:part.size[2]}):B.VertexData.CreateSphere({diameterX:part.size[0],diameterY:part.size[1],diameterZ:part.size[2],segments:8});const start=bucket.p.length/3;bucket.p.push(...g.positions);bucket.n.push(...g.normals);for(const index of g.indices)bucket.i.push(start+index);bucket.records.push({part,start,count:g.positions.length/3});}
 const observer=Object.entries(buckets).map(([kind,b])=>{const p=new Float32Array(b.p.length),n=new Float32Array(b.n.length),m=mesh('central traveler '+kind,p,n,b.i,null,{kind:'traveler-'+kind,category:'cell-traveler',figureId:'player',cellId:'W+',representation:'central-display-observer',color:kind==='suit'?'#e8ece5':kind==='detail'?'#7a8b91':'#dfbb73',alpha:1});return {...b,p,n,m};});
 let floorCos=1,floorSin=0;const floorAt=x=>{const d=state.distance,scale=d-1,a=Math.abs(floorCos)>1e-10?(floorCos*scale+floorSin*x)/(-Math.sign(floorCos)-floorCos*d):Infinity,b=Math.abs(floorSin)>1e-10?(floorSin*scale-floorCos*x)/(-Math.sign(floorSin)-floorSin*d):Infinity;return Math.min(a,b);};
 function refresh(){
  floorCos=Math.cos(state.angle);floorSin=Math.sin(state.angle);
  for(let i=0;i<16;i++)project(vertices[i],points[i]);
  for(let e=0;e<32;e++){const [a,b]=edges[e].map(i=>points[i]),d=normalize(subtract(b,a),[1,0,0]),u=normalize(cross3(d,Math.abs(d[1])<.9?[0,1,0]:[1,0,0]),[0,0,1]),v=cross3(d,u),base=e*rv*3;for(let j=0;j<sides;j++){const c=Math.cos(j*2*Math.PI/sides),s=Math.sin(j*2*Math.PI/sides);for(let k=0;k<3;k++){const n=u[k]*c+v[k]*s;ep[base+j*3+k]=a[k]+n*.035;ep[base+(j+sides)*3+k]=b[k]+n*.035;en[base+j*3+k]=en[base+(j+sides)*3+k]=n;}}for(let k=0;k<3;k++){ep[base+2*sides*3+k]=a[k];ep[base+(2*sides+1)*3+k]=b[k];en[base+2*sides*3+k]=-d[k];en[base+(2*sides+1)*3+k]=d[k];}}upload(rods,ep,en);
  for(const f of fills){for(let j=0;j<4;j++)f.fp.set(points[f.face[j]],j*3);B.VertexData.ComputeNormals(f.fp,f.fi,f.fn);upload(f.m,f.fp,f.fn);const selected=f.owners.some(c=>c.id===state.selected);f.m.material=selected?fillMaterials[state.selected]:neutralFill;f.m.visibility=1;f.m.metadata.cellId=selected?state.selected:f.owners[0].id;}
  for(const f of figures){updateStatueBuffers(f.source,f.f.paletteKind,state.angle,state.plane,f.sp,f.sn);upload(f.m,f.sp,f.sn);}
  const time=-state.angle/REFERENCE_OMEGA;let clearance=Infinity;
  for(const b of observer){for(const {part,start,count}of b.records){const angle=part.group==='body'?0:(part.group.startsWith('left')?1:-1)*(part.group.includes('Leg')?.4:-.5)*Math.sin(2*Math.PI*time/1.12),c=Math.cos(angle),s=Math.sin(angle),joint=SUIT_JOINTS[part.group];for(let j=start;j<start+count;j++){const i=j*3;const vx=b.rawP[i]+part.position[0],vy=b.rawP[i+1]+part.position[1],vz=b.rawP[i+2]+part.position[2];b.p[i]=(s*vy+c*vz+joint[2])*.294;b.p[i+1]=(c*vy-s*vz+joint[1])*.294;b.p[i+2]=-(vx+joint[0])*.294;const nx=b.rawN[i],ny=b.rawN[i+1],nz=b.rawN[i+2];b.n[i]=s*ny+c*nz;b.n[i+1]=c*ny-s*nz;b.n[i+2]=-nx;clearance=Math.min(clearance,b.p[i+1]-(state.plane==='XW'?floorAt(b.p[i]):-1));}}}
  for(const b of observer){for(let i=1;i<b.p.length;i+=3)b.p[i]-=clearance;if(state.plane!=='XW'){for(let i=0;i<b.p.length;i+=3){const q=project([b.p[i],-b.p[i+2],b.p[i+1],-1],[0,0,0]);b.p.set(q,i);}B.VertexData.ComputeNormals(b.p,b.i,b.n);}b.m.metadata.representation=state.plane==='XW'?'central-display-observer':'W-minus-projected-observer';b.m.metadata.cellId=state.plane==='XW'?null:'W-';upload(b.m,b.p,b.n);}return state;
 }
 for(const b of observer){b.rawP=buckets[b.m.metadata.kind.slice(9)].p;b.rawN=buckets[b.m.metadata.kind.slice(9)].n;}
 refresh();return {root,meshes,parts:meshes,get state(){return state;},get geometry(){return modelGeometry(state);},floorAt,setSelectedCell(id){state=modelState({...state,selected:id});return refresh();},setRotationPlane(plane){state=modelState({...state,plane});return refresh();},set4DAngle(angle){state=modelState({...state,angle});return refresh();},setViewRotation(x,y,z){root.rotation.set(x,y,z);},dispose(){if(disposed)return;disposed=true;root.dispose(false);owned.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());meshes.length=0;}};
}
