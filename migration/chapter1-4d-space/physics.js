export const LENGTH=12, PERIOD=48, RADIUS=.24;
export function wrap(z){return ((z+6)%PERIOD+PERIOD)%PERIOD-6;}
export function cell(z){return ((Math.floor((z+6)/LENGTH)%4)+4)%4;}
// A circle against the axis-aligned room walls, doorway jambs and landmark plinths.
export function obstacles(z){let a=[];let k=Math.floor((z+6)/12);for(let i=k-1;i<=k+1;i++){let c=i*12;a.push([-5.3,-5,-6+c,6+c],[5,5.3,-6+c,6+c],[-5,-1.65,5.82+c,6.18+c],[1.65,5,5.82+c,6.18+c],[-3.95,-2.25,-.85+c,.85+c],[2.5,3.9,1.3+c,2.7+c]);}return a;}
export function valid(x,z){return !obstacles(z).some(([a,b,c,d])=>{let dx=x-Math.max(a,Math.min(x,b)),dz=z-Math.max(c,Math.min(z,d));return dx*dx+dz*dz<RADIUS*RADIUS-1e-9;});}
export function advance(p,dx,dz){let n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));let x=p.x,z=p.z;for(let i=0;i<n;i++){if(valid(x+dx/n,z))x+=dx/n;if(valid(x,z+dz/n))z+=dz/n;}return{x,z:wrap(z)};}
