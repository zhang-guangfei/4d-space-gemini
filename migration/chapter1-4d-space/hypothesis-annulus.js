export const HALL_INNER=3.2,HALL_OUTER=3.84,HALL_BOTTOM=-.325,HALL_TOP=.3;
/** One continuous annular room, not four separate boxes; no center disk. */
export function annulusGeometry({innerRadius=HALL_INNER,outerRadius=HALL_OUTER,bottom=HALL_BOTTOM,top=HALL_TOP,segments=96}={}){
 if(!(innerRadius>0&&outerRadius>innerRadius&&top>bottom&&Number.isInteger(segments)&&segments>=8))throw Error('Invalid annular room dimensions');
 const positions=[],indices=[],outlines=[];
 for(const [r,y]of [[innerRadius,bottom],[innerRadius,top],[outerRadius,bottom],[outerRadius,top]]){const loop=[];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,p=[Math.sin(a)*r,y,Math.cos(a)*r];positions.push(...p);loop.push(p);}outlines.push(loop);}
 const stride=segments+1;for(const [a,b]of [[0,1],[2,3],[0,2],[1,3]])for(let i=0;i<segments;i++){const u=a*stride+i,v=b*stride+i;indices.push(u,v,u+1,u+1,v,v+1);}
 return {positions,indices,outlines};
}
