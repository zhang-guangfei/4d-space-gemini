// Statue-only studio fill. Fixed exhibit-space lobes avoid a headlamp that follows
// the viewer, while the opposing/bottom fill keeps rotated backs readable.
// Portal hosts inverse-transform normals to the room frame before calling it.
// This same bounded response is used by portal and inspector materials.
export const STATUE_LIGHTING_GLSL=`
float statueLobe(vec3 N,vec3 direction){
 float wrapped=.5+.5*dot(N,normalize(direction));
 return wrapped*wrapped;
}
vec3 softStatueColor(vec3 albedo,vec3 N){
 float illumination=.46
  +.28*statueLobe(N,vec3(-.45,.8,-.35))
  +.14*statueLobe(N,vec3(.65,.25,.72))
  +.10*statueLobe(N,vec3(-.2,-.85,.48));
 // Diffuse marble: no camera-dependent white specular streak or emissive wash.
 return albedo*illumination;
}`;
export function createSoftStatueMaterial(B,scene,name,texture){
 B.Effect.ShadersStore.softStatueVertexShader=`precision highp float;
 attribute vec3 position;attribute vec3 normal;attribute vec2 uv;
 uniform mat4 world;uniform mat4 worldViewProjection;
 varying vec3 vNormal;varying vec2 vUV;
 void main(){vNormal=normalize(mat3(world)*normal);vUV=uv;
 gl_Position=worldViewProjection*vec4(position,1.0);}`;
 B.Effect.ShadersStore.softStatueFragmentShader=`precision highp float;
 varying vec3 vNormal;varying vec2 vUV;uniform sampler2D labelTexture;
 ${STATUE_LIGHTING_GLSL}
 void main(){vec3 N=normalize(vNormal);if(!gl_FrontFacing)N=-N;
 gl_FragColor=vec4(softStatueColor(texture2D(labelTexture,vUV).rgb,N),1.0);}`;
 const m=new B.ShaderMaterial(name,scene,{vertex:'softStatue',fragment:'softStatue'},
 {attributes:['position','normal','uv'],uniforms:['world','worldViewProjection'],samplers:['labelTexture']});
 m.setTexture('labelTexture',texture);m.backFaceCulling=false;m.disableDepthWrite=false;
 m.metadata={statueSoftLighting:true};return m;
}
