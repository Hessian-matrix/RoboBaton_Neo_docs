import * as T from './three.module.js';
import {createEnclosure,lightProduct} from './enclosure-model.js?v=dfc7a1e200a6';
import {GLTFLoader} from './GLTFLoader.js';

// CAD coordinates remain in millimetres. Reuse the page's projector and controls.
const status = {ready:false, source:'camera-board-v2', meshes:0};
window.neoCadStatus = status;
async function setup(){
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true});
 renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 const scene=new T.Scene(),camera=new T.OrthographicCamera();
 camera.matrixAutoUpdate=false;
 lightProduct(scene);
 const gltf=await new GLTFLoader().loadAsync(new URL('./product-v2.glb',import.meta.url).href);
 // Undo only the exporter's mm/Z-up to glTF metre/Y-up root transform.
 const cadRoot=gltf.scene.children[0];cadRoot.rotation.set(0,0,0);cadRoot.scale.setScalar(1);cadRoot.updateMatrix();
 const bare=new T.Group();scene.add(bare);bare.add(gltf.scene);
 // STEP: lens at (11,10), board top 1.586; page: lens at (0,0), front 4.2.
 gltf.scene.matrixAutoUpdate=false;
 gltf.scene.matrix.set(0,-1,0,10, 1,0,0,-11, 0,0,1,-10.886156972314, 0,0,0,1);
 gltf.scene.traverse(o=>{
  if(!o.isMesh)return;status.meshes++;o.frustumCulled=false;
  const role=o.name==='pcb'||o.parent?.name==='pcb'?'pcb':o.name==='lens'||o.parent?.name==='lens'?'lens':'part';
  const materials=Array.isArray(o.material)?o.material:[o.material];
  o.material=materials.map(source=>{
   const m=new T.MeshLambertMaterial({color:source.color.clone(),side:T.DoubleSide}),c=m.color;
   if(role==='pcb'){m.color.set(c.r>.4&&c.g>.4&&c.b<.5?0x9b8552:0x174d37);}
   else if(role==='lens'){m.color.set(0x465359);}
   return m;
  });
  if(o.material.length===1)o.material=o.material[0];
  if(role==='lens'&&!Array.isArray(o.material)){
   // Assign glass only to the existing upper convex surface, no floating discs.
   const g=o.geometry.clone(),p=g.attributes.position,n=g.attributes.normal,ix=g.index;
   const metal=o.material,glass=new T.MeshLambertMaterial({color:0x24464c,side:T.DoubleSide});
   g.clearGroups();let first=0,previous=-1;
   for(let j=0;j<ix.count;j+=3){
    const ids=[ix.getX(j),ix.getX(j+1),ix.getX(j+2)];
    const isGlass=ids.every(i=>p.getZ(i)>12&&Math.hypot(p.getX(i),p.getY(i))<6.9)&&ids.reduce((s,i)=>s+n.getZ(i),0)>.6;
    const material=isGlass?1:0;if(previous!==material){if(j>first)g.addGroup(first,j-first,previous);first=j;previous=material;}
   }
   g.addGroup(first,ix.count-first,previous);o.geometry=g;o.material=[metal,glass];
  }
 });
 const shell=createEnclosure();scene.add(shell);
 window.drawNeoCadModel=(context,project,width,height,variant,faces)=>{
  if(renderer.getContext().isContextLost())return false;
  bare.visible=variant==='bare';shell.visible=!bare.visible;
  const origin=project([0,0,0]),basis=[[1,0,0],[0,1,0],[0,0,1]].map(v=>project(v).map((x,i)=>x-origin[i]));
  const x=basis.map(v=>-v[0]),y=basis.map(v=>-v[1]),z=basis.map(v=>v[2]);
  const sx=Math.hypot(...x),sy=Math.hypot(...y),sz=Math.hypot(...z);
  // Camera basis and projection come from the same affine transform as dimensions.
  camera.matrixWorldInverse.set(...x.map(v=>v/sx),(width/2-origin[0])/sx,...y.map(v=>v/sy),(height/2-origin[1])/sy,...z.map(v=>v/sz),origin[2]/sz-200,0,0,0,1);
  camera.matrixWorld.copy(camera.matrixWorldInverse).invert();camera.matrix.copy(camera.matrixWorld);
  camera.left=-width/(2*sx);camera.right=-camera.left;camera.top=height/(2*sy);camera.bottom=-camera.top;camera.near=.1;camera.far=500;camera.updateProjectionMatrix();
  const ratio=Math.min(2,Math.max(1,context.getTransform().a));
  const w=Math.round(width*ratio),h=Math.round(height*ratio);
  if(renderer.domElement.width!==w||renderer.domElement.height!==h)renderer.setSize(w,h,false);
  renderer.render(scene,camera);
  // The original 2D projector uses mirrored handedness. Mirror the final image,
  // keeping a proper camera rotation for normal lighting and front-face testing.
  context.save();context.translate(width,0);context.scale(-1,1);context.drawImage(renderer.domElement,0,0,width,height);context.restore();
  status.triangles=renderer.info.render.triangles;return true;
 };
 scene.updateMatrixWorld(true);status.bounds=new T.Box3().setFromObject(bare).getSize(new T.Vector3()).toArray();
 status.ready=true;window.dispatchEvent(new Event('resize'));
}
setup().catch(error=>{status.error=error.message;/* Existing depth renderer remains available. */});
