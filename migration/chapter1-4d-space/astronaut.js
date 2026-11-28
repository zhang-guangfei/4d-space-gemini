/** Original lightweight suit geometry. Eye origin is shared by local and optical avatars.
 * Matte opaque shell; the life-support pack does not share a plane with the torso.
 */
export const SUIT_COLORS=Object.freeze({suit:'#e8ece5',joint:'#7a8b91',visor:'#637d88',panel:'#acbec3',left:'#ee786c',right:'#dfbb73'});
export const SUIT_PARTS=Object.freeze([
 {name:'torso',group:'body',shape:'sphere',size:[.46,.64,.30],position:[0,-.55,-.02],material:'suit'},
 {name:'backpack',group:'body',shape:'sphere',size:[.36,.45,.20],position:[0,-.51,-.29],material:'suit',hideLocal:true},
 {name:'backpack panel',group:'body',shape:'box',size:[.20,.18,.018],position:[0,-.51,-.405],material:'panel',hideLocal:true},
 {name:'helmet',group:'body',shape:'sphere',size:[.40,.39,.38],position:[0,-.095,0],material:'suit',hideLocal:true},
 {name:'visor',group:'body',shape:'sphere',size:[.32,.18,.10],position:[0,-.10,.171],material:'visor',hideLocal:true},
 {name:'neck collar',group:'body',shape:'sphere',size:[.28,.08,.25],position:[0,-.29,0],material:'joint',hideLocal:true},
 {name:'chest controls',group:'body',shape:'box',size:[.22,.16,.025],position:[0,-.48,.151],material:'panel',hideLocal:true},
 ...['left','right'].flatMap((side,i)=>[
  {name:side+' shoulder patch',group:'body',shape:'sphere',size:[.13,.14,.28],position:[i?.29:-.29,-.30,0],material:side},
  {name:side+' leg',group:side+'Leg',shape:'sphere',size:[.19,.64,.21],position:[0,-.33,0],material:'suit'},
  {name:side+' boot',group:side+'Leg',shape:'sphere',size:[.23,.20,.34],position:[0,-.74,.10],material:'joint'},
  {name:side+' sole stripe',group:side+'Leg',shape:'box',size:[.18,.025,.25],position:[0,-.8275,.10],material:side},
  {name:side+' arm',group:side+'Arm',shape:'sphere',size:[.15,.50,.16],position:[0,-.23,.035],material:'suit'},
  {name:side+' cuff',group:side+'Arm',shape:'sphere',size:[.16,.075,.17],position:[0,-.43,.05],material:side},
  {name:side+' glove',group:side+'Arm',shape:'sphere',size:[.17,.17,.18],position:[0,-.50,.05],material:'suit'}
 ])
]);
export const SUIT_JOINTS=Object.freeze({body:[0,0,0],leftLeg:[-.13,-.84,-.03],rightLeg:[.13,-.84,-.03],leftArm:[-.34,-.30,0],rightArm:[.34,-.30,0]});
export function createAstronautSuit(B,scene,{material,parent=null}={}){
 const body=new B.TransformNode('astronaut',scene);body.parent=parent;body.metadata={asset:'original-astronaut-suit',anchor:'eyes'};
 const groups={body},parts=[];for(const [key,pos]of Object.entries(SUIT_JOINTS)){if(key==='body')continue;const node=new B.TransformNode(key+' joint',scene);node.parent=body;node.position.set(...pos);groups[key]=node;}
 for(const p of SUIT_PARTS){const mesh=p.shape==='box'?B.MeshBuilder.CreateBox(p.name,{width:p.size[0],height:p.size[1],depth:p.size[2]},scene):B.MeshBuilder.CreateSphere(p.name,{diameterX:p.size[0],diameterY:p.size[1],diameterZ:p.size[2],segments:10},scene);mesh.position.set(...p.position);mesh.parent=groups[p.group];mesh.material=material(p.material);mesh.metadata={asset:'original-astronaut-suit',suitPart:p.name,hideLocal:!!p.hideLocal};parts.push(mesh);}
 return {body,parts,arms:{left:groups.leftArm,right:groups.rightArm},legs:{left:groups.leftLeg,right:groups.rightLeg}};
}
/** Low-poly closed 3D suit meshes for batched room markers, not billboards. */
export function miniatureSuitGeometry(){
 const buckets={suit:{positions:[],normals:[],indices:[]},detail:{positions:[],normals:[],indices:[]},accent:{positions:[],normals:[],indices:[]}};
 for(const p of SUIT_PARTS){const key=['left','right'].includes(p.material)?'accent':p.material==='suit'?'suit':'detail',out=buckets[key],start=out.positions.length/3,origin=p.position.map((x,i)=>x+SUIT_JOINTS[p.group][i]);
  // Ellipsoids keep the miniature round and avoid coplanar box layers.
  const rows=5,cols=8;for(let r=0;r<=rows;r++){const phi=r/rows*Math.PI;for(let c=0;c<=cols;c++){const theta=c/cols*2*Math.PI;const v=[Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta)];out.positions.push(...v.map((x,i)=>origin[i]+x*p.size[i]/2));const normal=v.map((x,i)=>x/p.size[i]),length=Math.hypot(...normal);out.normals.push(...normal.map(x=>x/length));}}
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){let a=start+r*(cols+1)+c,b=a+cols+1;out.indices.push(a,b,a+1,a+1,b,b+1);}
 }
 return buckets;
}
