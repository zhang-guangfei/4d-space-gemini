import {sphereCorridorGeometry} from './sphere-corridor.js';
import {hypothesisRoomColor,hypothesisSurfaceColor} from './hypothesis-colors.js';
import {createColoredTesseract} from './colored-tesseract.js';
import {REFERENCE_CAMERA,REFERENCE_PARAMS} from './tesseract-reference.js';
import {beltRoomPose,hallPose,rotatingSidePose} from './model-poses.js';
import {roomModel} from './model-content.js';
/** Three manipulable Euclidean hypotheses, not explanations of the actual atlas. */
export const HYPOTHESIS_IDS=['central-hall','treadmill','sphere'];
export const MODEL_IDS=[...HYPOTHESIS_IDS,'colored-tesseract'];
export const HYPOTHESIS_DESCRIPTIONS=Object.fromEntries([['central-hall','X-'],['treadmill','X+'],['sphere','W-'],['colored-tesseract','W+']].map(([key,id])=>[key,roomModel(id).explanation]));
export function buildHypothesisScene(B,scene,onInspect=()=>{}){
 const groups={},models={},disposables=[];
 const mat=(name,color,alpha=1)=>{const m=new B.StandardMaterial(name,scene);m.diffuseColor=B.Color3.FromHexString(color);m.emissiveColor=m.diffuseColor.scale(.28);m.specularColor=new B.Color3(.4,.5,.55);m.alpha=alpha;disposables.push(m);return m;};
 const cyan=mat('lab cyan','#56dbdb'),amber=mat('lab amber','#f7b75e'),dark=mat('lab graphite','#263e50'),white=mat('lab white','#e4f4ef'),glass=mat('lab transparent blue','#407c99',.22),red=mat('lab red axis','#ed6f6f'),green=mat('lab green axis','#82dd97'),blue=mat('lab blue axis','#68a7ff');
 const roomMaterials={};
 const roomMat=id=>roomMaterials[id]||(roomMaterials[id]=mat('local room '+id,hypothesisSurfaceColor(id),.27));
 const box=(name,size,pos,material,parent)=>{const m=B.MeshBuilder.CreateBox(name,{width:size[0],height:size[1],depth:size[2]},scene);m.position.set(...pos);m.material=material;m.parent=parent;return m;};
 const line=(name,points,color,parent)=>{const m=B.MeshBuilder.CreateLines(name,{points:points.map(p=>new B.Vector3(...p))},scene);m.color=B.Color3.FromHexString(color);m.parent=parent;return m;};
 function traveler(parent,name){const g=new B.TransformNode(name,scene);g.parent=parent;box(name+' torso',[.23,.34,.15],[0,.2,0],amber,g);const head=B.MeshBuilder.CreateSphere(name+' helmet',{diameter:.21,segments:12},scene);head.position.y=.47;head.material=white;head.parent=g;g.head=head;box(name+' visor',[.14,.07,.025],[0,0,.10],dark,head);box(name+' boots',[.30,.07,.2],[0,.025,0],dark,g);return g;}
 // Open wire diagrams have no pedestal, floor plate or opaque backing.
 function wireCell(name,pos,color,parent,category,tag,size=.55){const n=new B.TransformNode(name,scene);n.position.set(...pos);n.parent=parent;n.metadata={category,tag,schematic:true};const h=size/2,points=[[-h,-h,-h],[h,-h,-h],[h,h,-h],[-h,h,-h],[-h,-h,h],[h,-h,h],[h,h,h],[-h,h,h]],edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];const mesh=B.MeshBuilder.CreateLineSystem(name+' open wire shell',{lines:edges.map(e=>e.map(i=>new B.Vector3(...points[i])))},scene);mesh.color=B.Color3.FromHexString(color);mesh.parent=n;mesh.metadata={category,tag,opaqueBacking:false};return n;}
 function identify(node,id,pos){node.metadata={...node.metadata,localRoomId:id,hypothesisLocal:true};return node;}
 function localSide(name,pos,parent,tag,id,size){const node=wireCell(name,pos,hypothesisRoomColor(id),parent,'hypothesis-side',tag,size);identify(node,id,[0,-size/2-.24,0]);const shell=box(id+' colored room volume',[size*.94,size*.94,size*.94],[0,0,0],roomMat(id),node);shell.metadata={localRoomId:id,hypothesisLocal:true};return node;}
 function link(name,a,b,color,parent){const m=B.MeshBuilder.CreateLines(name,{points:[new B.Vector3(...a),new B.Vector3(...b)],updatable:true},scene);m.color=B.Color3.FromHexString(color);m.parent=parent;m.metadata={connection:true,schematic:true};return {mesh:m,set(a,b){B.MeshBuilder.CreateLines(name,{points:[new B.Vector3(...a),new B.Vector3(...b)],instance:m},scene);}};}
 function group(id){const g=new B.TransformNode('hypothesis '+id,scene);g.scaling.setAll(1.5);g.metadata={modelScale:1.5,noPedestal:true};groups[id]=g;return g;}

 // Central hall: real square rooms surround a fixed central room; observer orbits.
 {
 const root=group('central-hall');const centralRoom=identify(box('central hall',[1.7,1.6,1.7],[0,.45,0],roomMat('HC'),root),'HC',[0,1,0]);
 const hallLeftShell=wireCell('hall predicted shared left',[0,.45,0],hypothesisRoomColor('HC'),root,'hypothesis-side','HYP L',1.75);
 const roomNodes=[];for(let k=0;k<4;k++){const a=k*Math.PI/2,x=Math.sin(a)*2.35,z=Math.cos(a)*2.35;const room=box('orbit room '+k,[1.25,1.25,1.25],[x,.30,z],roomMat('H'+(k+1)),root);identify(room,'H'+(k+1),[0,.85,0]);room.rotation.y=a;box('orbit room floor '+k,[1.25,.03,1.25],[0,-.64,0],dark,room);roomNodes.push({room});}
 const points=[];for(let i=0;i<=96;i++){let a=i/96*Math.PI*2;points.push([Math.sin(a)*2.35,0,Math.cos(a)*2.35]);}const corridorMat=mat('hall open transparent connecting corridor','#407c99',.08);corridorMat.backFaceCulling=false;corridorMat.disableDepthWrite=true;const corridor=B.MeshBuilder.CreateTube('hall connecting room corridor',{path:points.map(p=>new B.Vector3(...p)),radius:.66,tessellation:12},scene);corridor.material=corridorMat;corridor.parent=root;
 const floorPaths=[-.25,.25].map(w=>Array.from({length:97},(_,i)=>{const a=i/96*Math.PI*2;return new B.Vector3(Math.sin(a)*(2.35+w),-.325,Math.cos(a)*(2.35+w));}));const walkFloor=B.MeshBuilder.CreateRibbon('hall continuous corridor floor',{pathArray:floorPaths,sideOrientation:B.Mesh.DOUBLESIDE},scene);walkFloor.material=dark;walkFloor.parent=root;
 const player=traveler(root,'orbit traveler');
 models['central-hall']={root,player,roomNodes,corridor,walkFloor,update(t){
  const pose=hallPose(t),C=new B.Vector3(0,.30,0),up=new B.Vector3(...pose.up);
  const quaternion=p=>{const matrix=B.Matrix.Identity();B.Matrix.FromXYZAxesToRef(new B.Vector3(...p.right),new B.Vector3(...p.up),new B.Vector3(...p.forward),matrix);return B.Quaternion.FromRotationMatrix(matrix);};
  corridor.position.copyFrom(C);
  roomNodes.forEach(({room},k)=>{const rp=hallPose(k);room.position.copyFrom(C.add(new B.Vector3(...rp.position).scale(2.35)));room.rotationQuaternion=quaternion(rp);});
  player.position.copyFrom(C.add(new B.Vector3(...pose.position).scale(2.35)).add(up.scale(-.615)));player.rotation.set(0,0,0);player.rotationQuaternion=quaternion(pose);player.head.rotationQuaternion=B.Quaternion.Identity();
 }};
 }
 // Treadmill: objects translate while observer is fixed; recycling is intentionally visible.
 {
 const root=group('treadmill');
 const rooms=[];for(let k=0;k<4;k++){const r=new B.TransformNode('belt room '+k,scene);r.parent=root;identify(r,'T'+(k+1),[0,1.48,0]);box('moving room shell',[1.6,1.25,1.25],[0,.52,0],roomMat('T'+(k+1)),r);box('moving room floor '+k,[1.6,.03,1.25],[0,-.12,0],dark,r);rooms.push(r);}const player=traveler(root,'stationary traveler');player.position.set(0,-.095,0);player.rotation.y=Math.PI/2;
 
 const rotatingRight=localSide('belt single fixed rotating right room',[0,.52,-1.35],root,'HYP R','TR1',.65);
 const rotatingLeft=localSide('belt single fixed rotating left room',[0,.52,1.35],root,'HYP L','TL1',.65);


 const fades=[];models.treadmill={root,player,rooms,fades,rotatingRight,rotatingLeft,update(t){
  rotatingRight.rotation.y=rotatingSidePose(t).yaw;rotatingLeft.rotation.y=rotatingSidePose(t,'left').yaw;
  player.rotation.y=Math.PI/2;
  rooms.forEach((r,k)=>{const pose=beltRoomPose(t,k);r.position.x=pose.x*1.6;fades[k]=pose.fade;for(const mesh of r.getChildMeshes(false)){mesh.visibility=pose.fade;if(mesh instanceof B.LinesMesh)mesh.alpha=pose.fade;}});
 }};
 }
 // Ordinary sphere hypothesis: walker is INSIDE the shell, on its equator.
 // Foot-anchor radius 1.72 < shell radius 1.75; head/up points inward.
 {
 const root=group('sphere'),radius=1.75,footRadius=1.72,center=new B.Vector3(0,1.45,0);
 const shellMaterial=mat('sphere cutaway transparent shell','#407c99',.10);shellMaterial.backFaceCulling=false;shellMaterial.disableDepthWrite=true;
 const globe=B.MeshBuilder.CreateSphere('ordinary 2 sphere inner shell',{diameter:radius*2,segments:32},scene);globe.position.copyFrom(center);globe.material=shellMaterial;globe.parent=root;
 const sectors=sphereCorridorGeometry().map(geometry=>{const room=new B.Mesh('sphere curved corridor '+geometry.id,scene),data=new B.VertexData();data.positions=geometry.positions;data.indices=geometry.indices;data.normals=[];B.VertexData.ComputeNormals(data.positions,data.indices,data.normals);data.applyToMesh(room);room.parent=root;room.position.copyFrom(center);room.material=roomMat(geometry.id);room.material.alpha=.28;room.material.backFaceCulling=false;room.material.disableDepthWrite=true;identify(room,geometry.id);room.metadata={...room.metadata,curvedCorridor:true,startAngle:geometry.startAngle,endAngle:geometry.endAngle};return {room,geometry};});
 const sphereLeft=localSide('sphere predicted left pole',[0,center.y+radius,0],root,'HYP L','SN',.45),sphereRight=localSide('sphere predicted right pole',[0,center.y-radius,0],root,'HYP R','SS',.45);
 const player=traveler(root,'sphere inner equator traveler');
 models.sphere={root,player,globe,radius,footRadius,center,sectors,sphereLeft,sphereRight,update(t,_variant,direction=1){
  const a=t*Math.PI/2,n=new B.Vector3(Math.sin(a),0,Math.cos(a)),up=n.negate(),forward=new B.Vector3(Math.cos(a)*direction,0,-Math.sin(a)*direction),right=B.Vector3.Cross(up,forward),leftPole=new B.Vector3(0,1,0),rightPole=leftPole.negate();
  sphereLeft.position.copyFrom(center.add(leftPole.scale(radius)));sphereRight.position.copyFrom(center.add(rightPole.scale(radius)));
  const matrix=B.Matrix.Identity();B.Matrix.FromXYZAxesToRef(right,up,forward,matrix);player.rotationQuaternion=B.Quaternion.FromRotationMatrix(matrix);player.position.copyFrom(center.add(n.scale(footRadius)));
  player.metadata={insideShell:true,equator:true,forwardDirection:direction};
 }};
 }
 const colored=createColoredTesseract(B,scene,{scale:1.5});colored.root.position.y=.6;groups['colored-tesseract']=colored.root;models['colored-tesseract']={root:colored.root,colored,update(t){colored.set4DAngle(-t*Math.PI/2);}};
 function setColoredCell(id){return colored.setSelectedCell(id);}
 function setColoredPlane(plane){return colored.setRotationPlane(plane);}
 function getColoredState(){return colored.state;}
 let selected='central-hall',selectedRoom=null,variant='orbit-horizontal',travel=0,travelDirection=1;
 function refresh(){for(const key of MODEL_IDS){groups[key].setEnabled(key===selected);if(key===selected)models[key].update(travel,variant,travelDirection);}}
 function select(id){if(!MODEL_IDS.includes(id))throw Error('Unknown hypothesis '+id);selected=id;selectedRoom=null;travelDirection=1;variant=id==='central-hall'?'orbit-horizontal':id==='treadmill'?'belt-forward':'great-circle';refresh();return HYPOTHESIS_DESCRIPTIONS[id];}
 function selectRoom(id){const content=roomModel(id);selected=content.base;selectedRoom=content.id;travelDirection=1;variant=content.variant;refresh();return content;}
 function setTravel(value,{inspect=true}={}){const next=Math.max(0,Math.min(4,Number(value)||0)),delta=next-travel;travelDirection=1;travel=next;refresh();if(inspect)onInspect(selected);return travel;}
 function setAnimationTravel(value){travelDirection=1;const phase=Number(value);return setTravel(Number.isFinite(phase)?((phase%4)+4)%4:0,{inspect:false});}
 setTravel(0,{inspect:false});select(selected);
 return {groups,models,select,selectRoom,setTravel,setAnimationTravel,setColoredCell,setColoredPlane,getColoredState,get selected(){return selected;},get selectedRoom(){return selectedRoom;},get travel(){return travel;},getDescription:()=>selectedRoom?roomModel(selectedRoom).explanation:HYPOTHESIS_DESCRIPTIONS[selected],dispose(){colored.dispose();Object.values(groups).forEach(g=>g.dispose(false,true));disposables.forEach(m=>m.dispose());}};
}
// The treadmill reference looks almost straight down the belt from −X, with
// its blue (+Z) room at screen-left. Other models keep their original view.
const DEFAULT_LAB_VIEW=Object.freeze({alpha:-Math.PI/2,beta:1.05,radius:11,target:Object.freeze([0,1.4,0])});
const TREADMILL_LAB_VIEW=Object.freeze({...DEFAULT_LAB_VIEW,alpha:3.18,beta:1.15});
export function createHypothesisLab(B,canvas,onInspect=()=>{}){
 const engine=new B.Engine(canvas,true,{stencil:true});engine.setHardwareScalingLevel(1/Math.min(Math.max(globalThis.devicePixelRatio||1,1),1.5));
 const scene=new B.Scene(engine);scene.clearColor=new B.Color4(.025,.055,.08,1);const view=DEFAULT_LAB_VIEW,camera=new B.ArcRotateCamera('hypothesis orbit',view.alpha,view.beta,view.radius,new B.Vector3(...view.target),scene);camera.fov=1.1;camera.lowerRadiusLimit=4;camera.upperRadiusLimit=15;camera.lowerBetaLimit=.15;camera.upperBetaLimit=1.55;camera.wheelPrecision=40;camera.attachControl(canvas,true);camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
 const ambient=new B.HemisphericLight('lab fill',new B.Vector3(.5,1,-.3),scene);ambient.intensity=.9;const sun=new B.DirectionalLight('lab key',new B.Vector3(-.5,-1,.3),scene);sun.intensity=.8;
 const lab=buildHypothesisScene(B,scene,onInspect);const originalProjection=camera.getProjectionMatrix.bind(camera);camera.getProjectionMatrix=(force=false)=>{const m=originalProjection(force);if(lab.selected==='colored-tesseract'){m.m[8]=2*(REFERENCE_CAMERA.principalPoint[0]-.5)/engine.getAspectRatio(camera);m.m[9]=2*(.5-REFERENCE_CAMERA.principalPoint[1]);}else{m.m[8]=0;m.m[9]=0;}return m;};engine.runRenderLoop(()=>scene.render());let disposed=false;
 function resetView(){const truth=lab.selected==='colored-tesseract',view=lab.selected==='treadmill'?TREADMILL_LAB_VIEW:DEFAULT_LAB_VIEW;camera.upVector=truth?new B.Vector3(...REFERENCE_CAMERA.engineUp):new B.Vector3(0,1,0);camera.fov=truth?REFERENCE_CAMERA.verticalFov:1.1;camera.lowerRadiusLimit=truth?3:4;camera.upperRadiusLimit=truth?18:15;camera.lowerBetaLimit=truth?.02:.15;camera.upperBetaLimit=truth?Math.PI-.02:1.55;if(truth){camera.setTarget(new B.Vector3(0,.6,0));camera.setPosition(new B.Vector3(...REFERENCE_CAMERA.enginePosition.map((v,i)=>v*1.5+(i===1?.6:0))));camera.rebuildAnglesAndRadius();}else{camera.setTarget(new B.Vector3(...view.target));camera.alpha=view.alpha;camera.beta=view.beta;camera.radius=view.radius;}camera.inertialAlphaOffset=0;camera.inertialBetaOffset=0;camera.inertialRadiusOffset=0;camera.inertialPanningX=0;camera.inertialPanningY=0;}
 // Apply the model-specific preset only on selection/reset, never in animation.
 function selectWithView(select,id){const previous=lab.selected,result=select(id);if(lab.selected==='treadmill'||previous==='treadmill'||lab.selected==='colored-tesseract'||previous==='colored-tesseract')resetView();return result;}
 return {...lab,scene,engine,select:id=>selectWithView(lab.select,id),selectRoom:id=>selectWithView(lab.selectRoom,id),setTravel:lab.setTravel,setAnimationTravel:lab.setAnimationTravel,resetView,resize(){if(!disposed)engine.resize();},dispose(){if(disposed)return;disposed=true;camera.detachControl();lab.dispose();scene.dispose();engine.dispose();}};
}
