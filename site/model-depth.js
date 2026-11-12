'use strict';
// Orthographic projected polygons; larger projected Z is nearer the viewer.
// One shared offscreen renderer serves both the product and trajectory canvases.
window.drawNeoDepthModel = (() => {
  const surface = document.createElement('canvas');
  const gl = surface.getContext('webgl', {alpha:true, antialias:true, premultipliedAlpha:false});
  let program, buffer, position, color;
  if (gl) {
    const shader = (type, source) => {
      const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));
      return s;
    };
    program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 position; attribute vec3 color; varying vec3 tint; void main(){gl_Position=vec4(position,1.0);tint=color;}'));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float; varying vec3 tint; void main(){gl_FragColor=vec4(tint,1.0);}'));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    buffer=gl.createBuffer();position=gl.getAttribLocation(program,'position');color=gl.getAttribLocation(program,'color');
  }
  const palette=new Map();
  function rgb(value){
    if(!palette.has(value)){
      const c=value.startsWith('#')?[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)):value.match(/[0-9]+/g).map(Number);
      palette.set(value,c);
    }
    return palette.get(value);
  }
  function software(context, faces, width, height, scale){
    // Correct depth ordering also on browsers without WebGL.
    const w=Math.round(width*scale),h=Math.round(height*scale);
    const image=context.createImageData(w,h),depth=new Float64Array(w*h);depth.fill(-Infinity);
    for(const f of faces){const c=rgb(f.color),p=f.points.map(q=>[q[0]*scale,q[1]*scale,q[2]]);
      for(let n=1;n<p.length-1;n++){const [a,b,d]=[p[0],p[n],p[n+1]];
        const area=(b[1]-d[1])*(a[0]-d[0])+(d[0]-b[0])*(a[1]-d[1]);if(Math.abs(area)<1e-10)continue;
        const left=Math.max(0,Math.floor(Math.min(a[0],b[0],d[0]))),right=Math.min(w-1,Math.ceil(Math.max(a[0],b[0],d[0])));
        const top=Math.max(0,Math.floor(Math.min(a[1],b[1],d[1]))),bottom=Math.min(h-1,Math.ceil(Math.max(a[1],b[1],d[1])));
        for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
          const u=((b[1]-d[1])*(x+.5-d[0])+(d[0]-b[0])*(y+.5-d[1]))/area;
          const v=((d[1]-a[1])*(x+.5-d[0])+(a[0]-d[0])*(y+.5-d[1]))/area,t=1-u-v;
          if(u<0||v<0||t<0)continue;const z=u*a[2]+v*b[2]+t*d[2],i=y*w+x;
          if(z<=depth[i])continue;depth[i]=z;image.data.set([...c,255],i*4);
        }
      }
    }
    const fallback=document.createElement('canvas');fallback.width=w;fallback.height=h;
    fallback.getContext('2d').putImageData(image,0,0);context.drawImage(fallback,0,0,width,height);
  }
  return function(context,faces,width,height){
    if(!width||!height)return;const scale=Math.max(1,context.getTransform().a);
    if(!gl||gl.isContextLost()){software(context,faces,width,height,scale);return;}
    const w=Math.round(width*scale),h=Math.round(height*scale);
    if(surface.width!==w)surface.width=w;if(surface.height!==h)surface.height=h;
    let near=-Infinity,far=Infinity;for(const f of faces)for(const p of f.points){near=Math.max(near,p[2]);far=Math.min(far,p[2]);}
    const range=Math.max(near-far,1e-6),vertices=[];
    for(const f of faces){const c=rgb(f.color).map(x=>x/255);
      for(let n=1;n<f.points.length-1;n++)for(const p of [f.points[0],f.points[n],f.points[n+1]])
        vertices.push(p[0]/width*2-1,1-p[1]/height*2,.9-1.8*(p[2]-far)/range,...c);
    }
    gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
    gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(color);gl.vertexAttribPointer(color,3,gl.FLOAT,false,24,12);
    gl.drawArrays(gl.TRIANGLES,0,vertices.length/6);context.drawImage(surface,0,0,width,height);
  };
})();
