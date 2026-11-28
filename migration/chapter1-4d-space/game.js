import {advance,cell} from './physics.js';
import {LookController} from './look.js';
const look=new LookController();
const $=id=>document.getElementById(id), canvas=$('world'), B=window.BABYLON;
const rooms=[{id:'W+',name:'青庭',color:'#63c5b3',sub:'THE ORIGIN'},{id:'X+',name:'琥珀厅',color:'#eab66b',sub:'THE TURN'},{id:'W−',name:'蓝室',color:'#75a9e3',sub:'THE OTHER SIDE'},{id:'X−',name:'绛廊',color:'#d18caa',sub:'THE RETURN'}];
let engine,scene,camera,ready=false,locked=false,visited=new Set([0]),seams=0,lastCell=0,completed=false,keys=new Set(),sensitivity=1,yVelocity=0;
const c3=h=>B.Color3.FromHexString(h);
try{
engine=new B.Engine(canvas,true,{stencil:true,preserveDrawingBuffer:true});engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio/1.5));scene=new B.Scene(engine);scene.clearColor=new B.Color4(.055,.075,.085,1);scene.fogMode=B.Scene.FOGMODE_EXP2;scene.fogDensity=.016;scene.fogColor=c3('#16222b');scene.ambientColor=c3('#87999c');
camera=new B.UniversalCamera('eyes',new B.Vector3(0,1.68,-2.8),scene);camera.minZ=.05;camera.maxZ=44;camera.fov=1.16;camera.rotation.y=0;camera.inputs.clear();
const hemi=new B.HemisphericLight('ambient',new B.Vector3(.3,1,.1),scene);hemi.intensity=.58;hemi.groundColor=c3('#30353f');
const sun=new B.DirectionalLight('soft directional',new B.Vector3(-.45,-1,.35),scene);sun.position=new B.Vector3(7,18,-12);sun.intensity=1.0;sun.diffuse=c3('#e6d7bc');
const shadows=new B.ShadowGenerator(2048,sun);shadows.useBlurExponentialShadowMap=true;shadows.blurKernel=24;shadows.darkness=.28;
function mat(name,hex,emission=0){let m=new B.StandardMaterial(name,scene);m.diffuseColor=c3(hex);m.specularColor=new B.Color3(.12,.14,.15);m.emissiveColor=c3(hex).scale(emission);return m;}
const wall=mat('warm mineral plaster','#b9b8aa'),ceiling=mat('charcoal ceiling','#343c40'),dark=mat('brushed graphite','#26343a'),trim=mat('pale stone trim','#c3c3b4'),metal=mat('satin bronze','#7e735b');
const floor=mat('honed concrete','#7e8989');const tex=new B.DynamicTexture('concrete grain',512,scene,false);let cx=tex.getContext();cx.fillStyle='#899393';cx.fillRect(0,0,512,512);let seed=42;for(let j=0;j<24000;j++){seed=(seed*1664525+1013904223)>>>0;let x=seed%512;seed=(seed*1664525+1013904223)>>>0;let y=seed%512;cx.fillStyle=j%2?'#74818118':'#c7ceca24';cx.fillRect(x,y,2,2);}cx.strokeStyle='#4b5d5c66';cx.lineWidth=2;cx.strokeRect(0,0,512,512);tex.update();tex.uScale=5;tex.vScale=6;floor.diffuseTexture=tex;
function box(name,w,h,d,x,y,z,m,shadow=false){let b=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);b.position.set(x,y,z);b.material=m;b.receiveShadows=true;if(shadow)shadows.addShadowCaster(b);return b;}
function sign(text,subtitle,color,x,y,z,rot=0,w=2.4,h=.8){let t=new B.DynamicTexture('sign '+text,{width:1024,height:320},scene,false),ctx=t.getContext();ctx.fillStyle='#17252b';ctx.fillRect(0,0,1024,320);ctx.fillStyle=color;ctx.font='bold 118px sans-serif';ctx.fillText(text,48,155);ctx.font='28px sans-serif';ctx.fillStyle='#c6d3cf';ctx.fillText(subtitle,52,236);t.update();let m=mat('sign','#ffffff',.45);m.diffuseTexture=t;let p=B.MeshBuilder.CreatePlane('room marker',{width:w,height:h},scene);p.material=m;p.position.set(x,y,z);p.rotation.y=rot;}
for(let i=-4;i<=7;i++){
let r=rooms[((i%4)+4)%4],z=i*12,accent=mat('accent '+i,r.color,.2),glow=mat('light '+i,r.color,1.3);
box('floor',10,.24,12,0,-.12,z,floor);box('ceiling',10,.22,12,0,4.31,z,ceiling);box('left wall',.3,4.2,12,-5.15,2.1,z,wall);box('right wall',.3,4.2,12,5.15,2.1,z,wall);
for(let x of [-3.325,3.325])box('portal wall',3.35,4.2,.36,x,2.1,z+6,wall,true);box('portal lintel',3.3,1.15,.36,0,3.625,z+6,wall,true);
for(let x of [-1.72,1.72]){box('door jamb',.15,3.15,.52,x,1.575,z+6,dark,true);box('door edge',.035,2.98,.56,x-Math.sign(x)*.08,1.52,z+6,glow);}box('door head',3.6,.15,.52,0,3.15,z+6,dark);box('threshold',3.3,.018,.45,0,.012,z+6,accent);
for(let x of [-4.94,4.94]){box('skirting',.06,.15,12,x,.08,z,dark);box('wall color inset',.035,1.4,7.5,x,2.2,z,accent);for(let dz of [-4.3,-1.7,.9,3.5])box('vertical ribs',.14,4.2,.10,x,2.1,z+dz,dark,true);}
for(let x of [-3.2,3.2]){box('ceiling track',.3,.16,10.6,x,4.1,z,dark);box('ceiling light',.12,.035,9.8,x,4.0,z,mat('warm luminaire','#fff0c9',1.6));}
for(let dz of [-3,3])box('ceiling beam',10,.18,.2,0,4.03,z+dz,dark,true);
box('landmark plinth',1.7,.52,1.7,-3.1,.26,z,dark,true);box('plinth top',1.8,.06,1.8,-3.1,.55,z,trim,true);let art;
if(((i%4)+4)%4===0)art=B.MeshBuilder.CreateTorus('origin ring',{diameter:1.48,thickness:.16,tessellation:64},scene);
else if(((i%4)+4)%4===1)art=B.MeshBuilder.CreatePolyhedron('amber octahedron',{type:1,size:.85},scene);
else if(((i%4)+4)%4===2)art=B.MeshBuilder.CreateBox('blue cube',{size:1.1},scene);
else art=B.MeshBuilder.CreateTorusKnot('rose knot',{radius:.48,tube:.1,radialSegments:64,tubularSegments:24},scene);
art.position.set(-3.1,1.55,z);art.rotation.set(.35,.45,((i%4)+4)%4===0?Math.PI/2:.2);art.material=accent;shadows.addShadowCaster(art);art.receiveShadows=true;
box('bench',1.4,.5,1.4,3.2,.25,z+2,dark,true);box('bench cushion',1.4,.08,1.4,3.2,.54,z+2,accent,true);
sign(r.id,r.sub,r.color,-3.35,2.7,z+5.79,0,2.3,.72);let next=rooms[((i+1)%4+4)%4];sign('→ '+next.id,'WALK THROUGH',next.color,0,3.68,z+5.78,0,2.6,.55);sign('← '+r.id,'RETURN PATH',r.color,0,3.68,z+6.22,Math.PI,2.6,.55);
let light=new B.PointLight('room fill '+i,new B.Vector3(0,3.25,z),scene);light.diffuse=c3(r.color);light.intensity=.55;light.range=8;
}
scene.materials.forEach(m=>{if(m.maxSimultaneousLights!==undefined)m.maxSimultaneousLights=5;});
scene.executeWhenReady(()=>{ready=true;$('start').disabled=false;$('start').textContent='进入 3D 漫游';$('stats').textContent='Babylon.js · 实时 3D';});
engine.runRenderLoop(()=>{if(locked){const pose=look.frame();camera.rotation.set(pose.pitch,pose.yaw,0);}let dt=Math.min(engine.getDeltaTime()/1000,.05);if(locked&&ready){let f=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),s=Number(keys.has('KeyD'))-Number(keys.has('KeyA')),norm=Math.hypot(f,s)||1;f/=norm;s/=norm;let yaw=camera.rotation.y,speed=3.2;let p=advance(camera.position,(Math.sin(yaw)*f+Math.cos(yaw)*s)*speed*dt,(Math.cos(yaw)*f-Math.sin(yaw)*s)*speed*dt);camera.position.x=p.x;camera.position.z=p.z;yVelocity-=9.81*dt;camera.position.y+=yVelocity*dt;if(camera.position.y<=1.68){camera.position.y=1.68;yVelocity=0;}let k=cell(p.z);if(k!==lastCell){seams++;visited.add(k);if(k===0&&visited.size===4)completed=true;lastCell=k;updateHUD();}}
scene.render();$('lookdiag').textContent=`输入诊断 · yaw ${look.yaw.toFixed(3)} / pitch ${look.pitch.toFixed(3)} · 最大包 ${Math.round(look.maxPacket)} px · 异常包 ${look.filtered} 次`; $('stats').textContent=`${Math.round(engine.getFps())} FPS · ${locked?'鼠标已锁定':'已暂停'} · ${seams} 次跨缝`;});
}catch(e){$('notice').textContent='无法启动 3D：'+e.message;$('start').textContent='需要支持 WebGL 的桌面浏览器';console.error(e);}
function updateHUD(){let r=rooms[lastCell];$('room').textContent=`${r.id} · ${r.name}`;$('room').style.color=r.color;$('goal').textContent=completed?'回环完成 · 已回到青庭，可以继续自由探索':`自由探索 · 已到访 ${visited.size} / 4 间 · 穿门即可继续`;$('world').setAttribute('aria-description',`当前 ${r.id} ${r.name}，到访${visited.size}间，跨缝${seams}次`);}
function pause(){keys.clear();look.transition();document.exitPointerLock?.();}
$('start').onclick=async()=>{if(!ready)return;$('notice').textContent='';try{canvas.focus();try{await canvas.requestPointerLock({unadjustedMovement:true});}catch(e){if(e.name==='NotSupportedError')await canvas.requestPointerLock();else throw e;}}catch(e){$('notice').textContent='鼠标锁定未成功，请再次点击进入；若浏览器拦截，请允许此页面锁定鼠标。';}};
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;keys.clear();look.transition();$('menu').classList.toggle('hidden',locked);$('start').textContent='继续漫游';});
document.addEventListener('pointerlockerror',()=>{$('notice').textContent='浏览器未允许锁定鼠标，请再次点击进入。';});
document.addEventListener('mousemove',e=>{if(!locked)return;look.push(e.movementX,e.movementY,sensitivity);});
document.addEventListener('keydown',e=>{if(locked&&['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);}});document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});$('pause').onclick=pause;
$('sensitivity').oninput=e=>{sensitivity=+e.target.value;$('sensvalue').textContent=sensitivity.toFixed(1)+'×';};$('reset').onclick=()=>{keys.clear();look.reset();camera.position.set(0,1.68,-2.8);camera.rotation.set(0,0,0);yVelocity=0;visited=new Set([0]);seams=0;lastCell=0;completed=false;updateHUD();$('notice').textContent='已回到青庭起点。';};window.addEventListener('resize',()=>engine?.resize());updateHUD();
