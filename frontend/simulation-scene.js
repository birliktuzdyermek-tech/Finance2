/* Small local WebGL room. No libraries, textures, model downloads or continuous render loop. */
window.QalqanSimulationScene = (() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const normal=a=>{const d=Math.hypot(...a)||1;return a.map(v=>v/d);};
  function lookAt(eye,target){const z=normal(sub(eye,target)),x=normal(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
  function perspective(aspect){const f=1/Math.tan(Math.PI/7),near=.1,far=60;return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);}
  const color=hex=>[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  function rotated(p,angles=[0,0,0]){let [x,y,z]=p;let c=Math.cos(angles[0]),s=Math.sin(angles[0]);[y,z]=[y*c-z*s,y*s+z*c];c=Math.cos(angles[1]);s=Math.sin(angles[1]);[x,z]=[x*c+z*s,-x*s+z*c];c=Math.cos(angles[2]);s=Math.sin(angles[2]);return [x*c-y*s,x*s+y*c,z];}
  function geometry(phase){
    const vertices=[];
    function triangle(points,n,c){for(const p of points)vertices.push(...p,...n,...c);}
    function box(center,size,hex,angles){
      const corners=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(p=>rotated(p.map((v,i)=>v*size[i]/2),angles).map((v,i)=>v+center[i]));
      for(const [ids,n] of [[[4,5,6,7],[0,0,1]],[[1,0,3,2],[0,0,-1]],[[5,1,2,6],[1,0,0]],[[0,4,7,3],[-1,0,0]],[[7,6,2,3],[0,1,0]],[[0,1,5,4],[0,-1,0]]]){
        const nm=rotated(n,angles),c=color(hex);triangle(ids.slice(0,3).map(i=>corners[i]),nm,c);triangle([ids[0],ids[2],ids[3]].map(i=>corners[i]),nm,c);
      }
    }
    function cylinder(center,radius,height,hex,segments=20){
      const c=color(hex),top=center[1]+height/2,bottom=center[1]-height/2;
      for(let i=0;i<segments;i++){
        const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
        const p=[center[0]+Math.cos(a)*radius,bottom,center[2]+Math.sin(a)*radius],q=[center[0]+Math.cos(b)*radius,bottom,center[2]+Math.sin(b)*radius];
        const u=[p[0],top,p[2]],v=[q[0],top,q[2]],n=[Math.cos((a+b)/2),0,Math.sin((a+b)/2)];
        triangle([p,q,u],n,c);triangle([q,v,u],n,c);triangle([[center[0],top,center[2]],u,v],[0,1,0],c);
      }
    }
    // Open room shell, floor planks and window on the left wall.
    box([0,-.17,0],[8.8,.3,6.6],'1e3344');box([-4.35,2,-.05],[.18,4.3,6.7],'284456');box([0,2,-3.3],[8.8,4.3,.18],'1d3548');
    box([0,.0,.25],[8.5,.035,6.3],'314c5d');
    for(let x=-4;x<=4;x+=.55)box([x,.025,.25],[.012,.006,6.2],'263f50');
    box([-.2,.045,1.3],[5.6,.025,3.3],'1b2e45');box([-.2,.062,1.3],[5.24,.01,2.94],'243d54');
    box([-4.23,2.65,-.7],[.08,2.3,2.75],'102335');box([-4.17,2.65,-.7],[.035,2.04,2.5],'84c5d0');
    box([-4.12,2.65,-.7],[.04,2.1,.055],'345467');box([-4.12,2.65,-.7],[.04,.055,2.5],'345467');
    // A framed screen with abstract Qalqan signal bars. No hard-coded risk score.
    box([.2,2.9,-3.16],[3.8,1.8,.12],'0b1d2d');box([.2,2.9,-3.08],[3.56,1.58,.03],'123f52');
    box([-.85,3.05,-3.05],[.62,.78,.025],'40d8c4',[0,0,Math.PI/4]);box([-.85,3.05,-3.02],[.4,.55,.02],'154856',[0,0,Math.PI/4]);
    for(let i=0;i<4;i++)box([.65,3.35-i*.3,-3.04],[1.3-i*.18,.07,.02],i===0?'58d8cf':'376c80');
    // Desk, supports, drawer handles, notebook and laptop.
    box([.2,1.42,.35],[5.1,.2,2.2],'be9473');box([.2,1.30,.35],[4.8,.08,2.05],'6b5549');
    for(const x of [-1.9,2.3])for(const z of [-.45,1.15])box([x,.66,z],[.12,1.3,.12],'142b3b');
    box([-1.25,.75,.15],[.95,1.13,1.5],'355365');
    for(let i=0;i<3;i++){box([-1.25,.48+i*.3,.915],[.86,.26,.02],'436478');box([-1.25,.52+i*.3,.943],[.24,.035,.03],'9ab4bf');}
    box([-.8,1.56,.35],[1.5,.08,1.0],'172b3d');box([-.8,2.05,-.08],[1.5,1.0,.09],'0c1c2c',[-.12,0,0]);
    box([-.8,2.05,-.013],[1.33,.83,.025],'2b687b',[-.12,0,0]);
    for(let i=0;i<4;i++)box([-.94,2.3-i*.17,.062-i*.02],[.75-i*.1,.04,.012],'71cfcf');
    for(let i=0;i<5;i++)box([-.8,1.61,.17+i*.13],[1.17,.012,.055],'476273');
    box([.25,1.56,.85],[.59,.055,.69],'dcdecb',[0,.15,0]);box([.23,1.595,.85],[.018,.02,.56],'315366',[0,.15,0]);
    // Phone on a small stand, visible screen and message cards.
    box([1.34,1.58,.74],[.75,.09,.55],'102a3a');box([1.34,1.86,.55],[.11,.62,.1],'385b6e',[-.2,0,0]);
    box([1.34,2.13,.79],[.7,1.33,.12],'091827');box([1.34,2.13,.863],[.6,1.18,.018],'214957');
    const accent=phase==='page'?'edb672':phase==='outcome'?'87b6cb':'59e0c5';
    box([1.34,2.39,.88],[.47,.26,.012],accent);box([1.34,2.12,.88],[.45,.10,.012],'a6d2d4');box([1.30,1.96,.88],[.37,.06,.012],'6b9cac');
    box([1.34,2.70,.89],[.19,.028,.012],'091827');box([1.34,1.60,.89],[.2,.02,.012],'a6d2d4');
    // Lamp, stool, plant and bookshelf give the room recognizable scale.
    cylinder([2.0,1.58,-.42],.25,.07,'183444');box([2.0,2.15,-.42],[.045,1.1,.045],'82a7b4');box([1.78,2.69,-.42],[.48,.045,.045],'82a7b4',[0,0,-.15]);
    cylinder([1.57,2.64,-.42],.29,.2,'dfcba7');cylinder([1.57,2.53,-.42],.25,.025,'ffe2a7');
    cylinder([-.4,.89,2.28],.56,.18,'537f89');cylinder([-.4,.41,2.28],.07,.8,'142d3b');
    box([-.4,.1,2.28],[1.1,.07,.1],'142d3b');box([-.4,.1,2.28],[.1,.07,1.1],'142d3b');
    cylinder([-3.25,.34,-2.2],.38,.65,'b59377');
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;box([-3.25+Math.sin(a)*.2,1.08+Math.cos(a)*.1,-2.2+Math.cos(a)*.2],[.14,1.2,.1],i%2?'579f82':'347666',[Math.cos(a)*.38,0,Math.sin(a)*.4]);}
    box([3.15,1.28,-2.7],[1.35,2.5,.7],'8a7865');
    for(let y=.3;y<2.5;y+=.67){box([3.15,y,-2.3],[1.22,.06,.45],'b6a083');for(let i=0;i<5;i++)box([2.7+i*.17,y+.23,-2.45],[.12,.4+(i%2)*.08,.29],['3b707c','b5a18a','6b8d94','c9b584','346576'][i]);}
    return new Float32Array(vertices);
  }
  function create(canvas,{project,onAvailability}){
    let gl,program,buffer,positionLoc,normalLoc,colorLoc,matrixLoc,count=0,frame=0,active=false,phase='notification',yaw=.57,pitch=.43,distance=11.8,drag=null,lost=false;
    function shader(type,source){const s=gl.createShader(type);if(!s)throw Error('shader');gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw Error('compile');}return s;}
    function upload(){const data=geometry(phase);count=data.length/9;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);}
    function setup(){
      try{
        gl=canvas.getContext('webgl',{antialias:true});if(!gl)throw Error('webgl');
        const vertex=shader(gl.VERTEX_SHADER,'attribute vec3 p;attribute vec3 n;attribute vec3 c;uniform mat4 m;varying vec3 color;void main(){float l=0.55+0.45*max(dot(normalize(n),normalize(vec3(0.4,0.9,0.65))),0.0);color=c*l;gl_Position=m*vec4(p,1.0);}');
        const fragment=shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 color;void main(){gl_FragColor=vec4(color,1.0);}');
        program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('link');
        buffer=gl.createBuffer();positionLoc=gl.getAttribLocation(program,'p');normalLoc=gl.getAttribLocation(program,'n');colorLoc=gl.getAttribLocation(program,'c');matrixLoc=gl.getUniformLocation(program,'m');
        upload();lost=false;canvas.dataset.render='webgl';onAvailability(true);request();
      }catch(_){canvas.dataset.render='fallback';onAvailability(false);}
    }
    function draw(){
      frame=0;if(!active||document.hidden||!gl||lost||canvas.dataset.render!=='webgl')return;
      const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;
      const ratio=Math.min(window.devicePixelRatio||1,2,1600/width,1200/height),w=Math.round(width*ratio),h=Math.round(height*ratio);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);gl.clearColor(.039,.071,.105,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      for(const [loc,offset] of [[positionLoc,0],[normalLoc,12],[colorLoc,24]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,36,offset);}
      const target=[0,1.35,0],eye=[Math.sin(yaw)*Math.cos(pitch)*distance,1.35+Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance];
      const m=multiply(perspective(w/h),lookAt(eye,target));gl.uniformMatrix4fv(matrixLoc,false,m);gl.drawArrays(gl.TRIANGLES,0,count);
      const p=[1.34,2.25,.9,1],q=[0,0,0,0];for(let row=0;row<4;row++)for(let col=0;col<4;col++)q[row]+=m[col*4+row]*p[col];
      project({x:clamp((q[0]/q[3]+1)*50,8,92),y:clamp((1-q[1]/q[3])*50,15,85)});
    }
    function request(){if(active&&!document.hidden&&!frame)frame=requestAnimationFrame(draw);}
    function move(direction){if(direction==='left')yaw-=.15;if(direction==='right')yaw+=.15;if(direction==='in')distance-=1;if(direction==='out')distance+=1;yaw=clamp(yaw,-.3,1.05);distance=clamp(distance,8.5,16);request();}
    function reset(){yaw=.57;pitch=.43;distance=11.8;request();}
    function down(e){if(!active||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,yaw};canvas.setPointerCapture(e.pointerId);}
    function pointerMove(e){if(drag&&e.pointerId===drag.id){yaw=clamp(drag.yaw+(drag.x-e.clientX)*.006,-.3,1.05);request();}}
    function up(){drag=null;}
    function key(e){const actions={ArrowLeft:'left',ArrowRight:'right','+':'in','=':'in','-':'out'};if(actions[e.key]){e.preventDefault();move(actions[e.key]);}if(e.key==='Home'){e.preventDefault();reset();}}
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('keydown',key);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;canvas.dataset.render='fallback';onAvailability(false);});
    canvas.addEventListener('webglcontextrestored',setup);
    const resize=new ResizeObserver(request);resize.observe(canvas);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else request();});
    setup();
    return {move,reset,setPhase(value){if(phase===value)return;phase=value;if(gl&&!lost&&canvas.dataset.render==='webgl')upload();request();},setActive(value){active=value;canvas.dataset.active=String(value);if(value)request();else{cancelAnimationFrame(frame);frame=0;drag=null;}},get active(){return active;}};
  }
  return {create};
})();
