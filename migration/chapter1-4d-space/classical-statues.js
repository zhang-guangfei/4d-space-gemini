import {ASSET_DATA} from './assets/classical-statues/geometry.js';
// Original approved shapes. Offline exports are bundled; no per-room download/import.
export const STATUE_ASSETS=Object.fromEntries([['bronze','venus'],['stone','david']].map(([kind,id])=>[kind,{name:id==='venus'?'venus-de-milo':'filip-david',id,bounds:ASSET_DATA[id].bounds,triangles:ASSET_DATA[id].high.triangles,lodTriangles:ASSET_DATA[id].low.triangles}]));
const sceneCache=new WeakMap(),decoded=new Map();
function unpack(value){const bytes=Uint8Array.from(atob(value.base64),c=>c.charCodeAt(0));return value.type==='u32'?new Uint32Array(bytes.buffer):new Float32Array(bytes.buffer);}
export function statueData(kind,lod='low') {const asset=STATUE_ASSETS[kind];if(!asset||!['high','low'].includes(lod))throw Error('Unknown classical statue');const key=asset.id+lod;if(!decoded.has(key)){const d=ASSET_DATA[asset.id][lod];decoded.set(key,Object.fromEntries(['positions','normals','indices','uvs'].map(k=>[k,unpack(d[k])])));}return decoded.get(key);}
function geometryFor(B,scene,kind,lod){let cache=sceneCache.get(scene);if(!cache){cache=new Map();sceneCache.set(scene,cache);}const key=kind+lod;let geometry=cache.get(key);if(!geometry||geometry.isDisposed()){const vd=new B.VertexData();Object.assign(vd,statueData(kind,lod));geometry=new B.Geometry('shared-classical-'+key,scene,vd,false);cache.set(key,geometry);}return geometry;}
export function prewarmClassicalStatues(B,scene){for(const kind of ['bronze','stone'])for(const lod of ['high','low'])geometryFor(B,scene,kind,lod);}
export function setStatueDetail(B,scene,mesh,lod){const kind=mesh.metadata?.statueKind;if(!kind)return;const geometry=geometryFor(B,scene,kind,lod);if(mesh.geometry!==geometry){geometry.applyToMesh(mesh);
 // Geometry swaps do not resize a clone's existing SubMesh draw range.
 // Rebuild the single-material draw range for BOTH near and far buffers.
 mesh.releaseSubMeshes();new B.SubMesh(0,0,mesh.getTotalVertices(),0,mesh.getTotalIndices(),mesh);
 mesh.metadata={...mesh.metadata,lod};}}
export function createClassicalStatue(B,scene,{kind='bronze',lod='low',name='classical-statue',material=null}={}){const asset=STATUE_ASSETS[kind];if(!asset)throw Error('Unknown classical statue '+kind);const mesh=new B.Mesh(name,scene);geometryFor(B,scene,kind,lod).applyToMesh(mesh);mesh.material=material;mesh.isPickable=false;mesh.metadata={asset:asset.name,statueKind:kind,lod,bounds:asset.bounds};return mesh;}
