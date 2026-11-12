import * as T from './three.module.js';
const TAU=Math.PI*2;let faces=[];
function face(points,color){faces.push({points,color})}
function box(c,s,color){const v=Array.from({length:8},(_,i)=>[c[0]+(i&1?.5:-.5)*s[0],c[1]+(i&2?.5:-.5)*s[1],c[2]+(i&4?.5:-.5)*s[2]]);[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]].forEach(f=>face(f.map(i=>v[i]),color));}
function cylinder(c,r,h,color){const ring=z=>Array.from({length:32},(_,i)=>[c[0]+r*Math.cos(i/32*TAU),c[1]+r*Math.sin(i/32*TAU),z]),a=ring(c[2]-h/2),b=ring(c[2]+h/2);face(a,color);face(b,color);for(let i=0;i<32;i++)face([a[i],a[(i+1)%32],b[(i+1)%32],b[i]],color);}
// Enclosure dimensions from the user's Neo dimension sheet:
// 43.8 x 23.8 x 21.6 mm including lens; shell 12.4 mm, lens offset 12.9 mm.
function enclosure(){
 const ring=[];const radius=3.1;
 for(const [x,y,start] of [[8.8,27.8,0],[-8.8,27.8,Math.PI/2],[-8.8,-9.8,Math.PI],[8.8,-9.8,Math.PI*1.5]]){
  for(let j=0;j<=8;j++){const a=start+j/8*Math.PI/2;ring.push([x+radius*Math.cos(a),y+radius*Math.sin(a)]);}
 }
 const bottom=ring.map(p=>[...p,-17.4]),seam=ring.map(p=>[...p,-15.9]),top=ring.map(p=>[...p,-5]);
 face(bottom,'#3f6753');face(top,'#759b83');
 for(let i=0;i<ring.length;i++){const j=(i+1)%ring.length;face([bottom[i],bottom[j],seam[j],seam[i]],'#3d6250');const shade=Math.round(92+12*Math.cos(i/ring.length*TAU));face([seam[i],seam[j],top[j],top[i]],`rgb(${shade-25},${shade+17},${shade-10})`);}
}
enclosure();
cylinder([0,0,-3.4],5.8,3.2,'#374c46');cylinder([0,0,-.5],6.3,2.6,'#435b51');cylinder([0,0,2.1],7,2.6,'#597363');cylinder([0,0,3.65],6.4,1.1,'#344f46');
cylinder([0,0,4.21],5.3,.02,'#8ebcb5');cylinder([0,0,4.24],4.35,.02,'#244d50');
const portFaceStart=faces.length;
box([0,30.92,-9.2],[9,.18,3.8],'#bcc8c0');box([0,31.04,-9.2],[7,.12,2.3],'#324b43');
box([0,30.92,-14],[11,.18,3.5],'#bbc6be');box([0,31.04,-14],[9,.12,2.3],'#314d42');
const contactStart=faces.length;
for(let i=0;i<6;i++)box([-3.5+i*1.4,31.12,-14],[.45,.08,1.4],'#ced9c9');
const contactFaces=faces.splice(contactStart);
const connectorFaces=faces.splice(portFaceStart);
box([11.93,22,-12.5],[.12,2.6,3.5],'#324e40');box([11.99,17,-9.5],[.12,1.3,1.3],'#e4c58b');
const tfSlotStart=faces.length;
box([11.94,0,-15.3],[.1,12.5,2.3],'#81998a');box([12.01,0,-15.3],[.1,11.5,1.3],'#203b2d');
const tfSlotFaces=faces.splice(tfSlotStart);

const geometryFaces=[...faces,...connectorFaces,...contactFaces,...tfSlotFaces];

// Shared homepage/interface geometry, palette and diffuse lighting.
export function createEnclosure(){
 const positions=[],colors=[];
 for(const f of geometryFaces){const c=new T.Color(f.color);for(let i=1;i<f.points.length-1;i++)for(const p of [f.points[0],f.points[i],f.points[i+1]]){positions.push(...p);colors.push(c.r,c.g,c.b);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();
 return new T.Mesh(g,new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide}));
}
export function lightProduct(scene){
 scene.add(new T.AmbientLight(0xffffff,.6));scene.add(new T.HemisphereLight(0xf5faff,0x78867c,1.65));
 for(const [color,power,x,y,z] of [[0xfff8ef,.95,-35,-30,65],[0xe6eef5,.45,40,25,25],[0xffffff,.3,0,45,-15]]){const l=new T.DirectionalLight(color,power);l.position.set(x,y,z);scene.add(l);}
}
