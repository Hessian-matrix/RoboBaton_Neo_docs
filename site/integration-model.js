import * as T from './three.module.js';
import {createEnclosure,lightProduct} from './enclosure-model.js';
const canvas=document.getElementById('connection-model');
if(canvas){try{
 const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 const scene=new T.Scene();lightProduct(scene);const model=createEnclosure();model.position.set(0,-9,11.2);scene.add(model);
 const camera=new T.OrthographicCamera(-32,32,32,-32,.1,500);camera.up.set(0,0,1);camera.position.set(80,90,65);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 function draw(){renderer.setSize(230,220,false);renderer.render(scene,camera);const q=new T.Vector3(0,22.04,2).project(camera),x=(q.x+1)*115,y=15+(1-q.y)*110;document.getElementById('usb-wire').setAttribute('d','M '+x+' '+y+' C '+(x+45)+' '+(y+12)+' 210 224 251 224 S 272 180 310 180');}
 draw();document.fonts.ready.then(draw);
}catch{canvas.hidden=true;document.getElementById('model-fallback').hidden=false;}}
