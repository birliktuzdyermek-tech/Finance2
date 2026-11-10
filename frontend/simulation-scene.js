/* Small local WebGL room. No libraries, textures or model downloads. Neon surfaces pulse and a radar sweeps the floor;
   the render loop runs only while the simulator is visible, is capped near 30 fps and is off for reduced motion. */
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
  // Each story has its own look: palette, neon colour, radar colour, sky colour. Unknown ids fall back to the office.
  const looks={
    'blocked-card':{wallL:'284456',wallB:'1d3548',floor:'314c5d',base:'1e3344',rug:'243d54',rugEdge:'1b2e45',neon:'22d3ff',neon2:'8b5cf6',radar:[.13,.83,1],bg:[.02,.035,.08]},
    'safe-transfer':{wallL:'2b3a52',wallB:'1c2840',floor:'2c3d52',base:'1b2a3c',rug:'20344f',rugEdge:'182a42',neon:'f5b84b',neon2:'22d3ff',radar:[.96,.72,.29],bg:[.03,.035,.07]},
    'ordinary-receipt':{wallL:'2d5559',wallB:'234a4f',floor:'4a6a66',base:'2a4a48',rug:'3a5d5a',rugEdge:'2a4a48',neon:'3ddc97',neon2:'22d3ff',radar:[.24,.86,.59],bg:[.02,.05,.06]},
    'qr-parking':{wallL:'1a2230',wallB:'1a2230',floor:'202a3a',base:'141b27',rug:'202a3a',rugEdge:'202a3a',neon:'22d3ff',neon2:'8b5cf6',radar:[.13,.83,1],bg:[.015,.025,.06]},
    'relative-transfer':{wallL:'3a2f5c',wallB:'2d2650',floor:'4a3f63',base:'2b2445',rug:'6a4c93',rugEdge:'4a3470',neon:'25d366',neon2:'8b5cf6',radar:[.15,.83,.4],bg:[.035,.025,.07]},
    'bank-call':{wallL:'1a2744',wallB:'121c33',floor:'202e47',base:'111a2c',rug:'16233b',rugEdge:'101b30',neon:'ff4d6d',neon2:'22d3ff',radar:[1,.3,.43],bg:[.015,.02,.05]},
    'marketplace-prepay':{wallL:'4a4540',wallB:'3a3733',floor:'5a5249',base:'3a3631',rug:'4a443c',rugEdge:'3a342d',neon:'f5b84b',neon2:'3ddc97',radar:[.96,.72,.29],bg:[.03,.03,.04]},
    'fake-job':{wallL:'24385a',wallB:'1a2c4b',floor:'33506a',base:'1d3047',rug:'27415f',rugEdge:'1d3350',neon:'8b5cf6',neon2:'f5b84b',radar:[.55,.36,.96],bg:[.025,.025,.08]}
  };
  const lookOf=id=>looks[id]||looks['blocked-card'];
  function geometry(phase,id){
    const vertices=[],L=lookOf(id);
    function triangle(points,n,c,g=0){for(const p of points)vertices.push(...p,...n,...c,g);}
    function box(center,size,hex,angles,g=0){
      const corners=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(p=>rotated(p.map((v,i)=>v*size[i]/2),angles).map((v,i)=>v+center[i]));
      for(const [ids,n] of [[[4,5,6,7],[0,0,1]],[[1,0,3,2],[0,0,-1]],[[5,1,2,6],[1,0,0]],[[0,4,7,3],[-1,0,0]],[[7,6,2,3],[0,1,0]],[[0,1,5,4],[0,-1,0]]]){
        const nm=rotated(n,angles),c=color(hex);triangle(ids.slice(0,3).map(i=>corners[i]),nm,c,g);triangle([ids[0],ids[2],ids[3]].map(i=>corners[i]),nm,c,g);
      }
    }
    function cylinder(center,radius,height,hex,segments=20,g=0){
      const c=color(hex),top=center[1]+height/2,bottom=center[1]-height/2;
      for(let i=0;i<segments;i++){
        const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
        const p=[center[0]+Math.cos(a)*radius,bottom,center[2]+Math.sin(a)*radius],q=[center[0]+Math.cos(b)*radius,bottom,center[2]+Math.sin(b)*radius];
        const u=[p[0],top,p[2]],v=[q[0],top,q[2]],n=[Math.cos((a+b)/2),0,Math.sin((a+b)/2)];
        triangle([p,q,u],n,c,g);triangle([q,v,u],n,c,g);triangle([[center[0],top,center[2]],u,v],[0,1,0],c,g);
      }
    }
    const G={box,cylinder},U=undefined;
    // ---- shared room pieces
    function shell(){
      box([0,-.17,0],[8.8,.3,6.6],L.base);box([-4.35,2,-.05],[.18,4.3,6.7],L.wallL);box([0,2,-3.3],[8.8,4.3,.18],L.wallB);
      box([0,.0,.25],[8.5,.035,6.3],L.floor);
      for(let x=-4;x<=4;x+=.55)box([x,.025,.25],[.012,.006,6.2],L.base);
      box([-.2,.045,1.3],[5.6,.025,3.3],L.rugEdge);box([-.2,.062,1.3],[5.24,.01,2.94],L.rug);
    }
    function windowLeft(glass='2aa6c9'){
      box([-4.23,2.65,-.7],[.08,2.3,2.75],'102335');box([-4.17,2.65,-.7],[.035,2.04,2.5],glass,U,1);
      box([-4.12,2.65,-.7],[.04,2.1,.055],'345467');box([-4.12,2.65,-.7],[.04,.055,2.5],'345467');
    }
    function wallScreen(face='0d4a66',bar='58d8cf'){
      box([.2,2.9,-3.16],[3.8,1.8,.12],'0b1d2d');box([.2,2.9,-3.08],[3.56,1.58,.03],face,U,1);
      box([-.85,3.05,-3.05],[.62,.78,.025],bar,[0,0,Math.PI/4],1);box([-.85,3.05,-3.02],[.4,.55,.02],'154856',[0,0,Math.PI/4]);
      for(let i=0;i<4;i++)box([.65,3.35-i*.3,-3.04],[1.3-i*.18,.07,.02],i===0?bar:'376c80',U,1);
    }
    function desk(top='be9473',under='6b5549'){
      box([.2,1.42,.35],[5.1,.2,2.2],top);box([.2,1.30,.35],[4.8,.08,2.05],under);
      for(const x of [-1.9,2.3])for(const z of [-.45,1.15])box([x,.66,z],[.12,1.3,.12],'142b3b');
    }
    function drawers(){
      box([-1.25,.75,.15],[.95,1.13,1.5],'355365');
      for(let i=0;i<3;i++){box([-1.25,.48+i*.3,.915],[.86,.26,.02],'436478');box([-1.25,.52+i*.3,.943],[.24,.035,.03],'9ab4bf');}
    }
    function laptop(screen='2b8aa6'){
      box([-.8,1.56,.35],[1.5,.08,1.0],'172b3d');box([-.8,2.05,-.08],[1.5,1.0,.09],'0c1c2c',[-.12,0,0]);
      box([-.8,2.05,-.013],[1.33,.83,.025],screen,[-.12,0,0],1);
      for(let i=0;i<4;i++)box([-.94,2.3-i*.17,.062-i*.02],[.75-i*.1,.04,.012],'71cfcf');
      for(let i=0;i<5;i++)box([-.8,1.61,.17+i*.13],[1.17,.012,.055],'476273');
    }
    function paper(x=.25,z=.85,tone='dcdecb'){box([x,1.56,z],[.59,.055,.69],tone,[0,.15,0]);box([x-.02,1.595,z],[.018,.02,.56],'315366',[0,.15,0]);}
    function lamp(shade='dfcba7'){
      cylinder([2.0,1.58,-.42],.25,.07,'183444');box([2.0,2.15,-.42],[.045,1.1,.045],'82a7b4');box([1.78,2.69,-.42],[.48,.045,.045],'82a7b4',[0,0,-.15]);
      cylinder([1.57,2.64,-.42],.29,.2,shade);cylinder([1.57,2.53,-.42],.25,.025,'ffe2a7',20,1);
    }
    function stool(seat='537f89'){cylinder([-.4,.89,2.28],.56,.18,seat);cylinder([-.4,.41,2.28],.07,.8,'142d3b');box([-.4,.1,2.28],[1.1,.07,.1],'142d3b');box([-.4,.1,2.28],[.1,.07,1.1],'142d3b');}
    function plant(){
      cylinder([-3.25,.34,-2.2],.38,.65,'b59377');
      for(let i=0;i<7;i++){const a=i*Math.PI*2/7;box([-3.25+Math.sin(a)*.2,1.08+Math.cos(a)*.1,-2.2+Math.cos(a)*.2],[.14,1.2,.1],i%2?'579f82':'347666',[Math.cos(a)*.38,0,Math.sin(a)*.4]);}
    }
    function shelf(){
      box([3.15,1.28,-2.7],[1.35,2.5,.7],'8a7865');
      for(let y=.3;y<2.5;y+=.67){box([3.15,y,-2.3],[1.22,.06,.45],'b6a083');for(let i=0;i<5;i++)box([2.7+i*.17,y+.23,-2.45],[.12,.4+(i%2)*.08,.29],['3b707c','b5a18a','6b8d94','c9b584','346576'][i]);}
    }
    function cup(x,z,tone='f1efe6'){cylinder([x,1.64,z],.13,.16,tone);cylinder([x,1.72,z],.11,.01,'6b4a2f');}
    function coins(x,z){for(let i=0;i<5;i++)cylinder([x,1.57+i*.04,z],.14,.035,'f5b84b',16,1);cylinder([x+.3,1.57,z+.1],.14,.035,'f5b84b',16,1);}
    function parcel(x,y,z,w,h,d,tone='c8a165'){box([x,y,z],[w,h,d],tone);box([x,y+h/2+.004,z],[w*.12,.012,d+.01],'e6d3a3');}
    // ---- the phone rig is identical in every scene so the hotspot always matches
    function phoneRig(){
      box([1.34,1.58,.74],[.75,.09,.55],'102a3a');box([1.34,1.86,.55],[.11,.62,.1],'385b6e',[-.2,0,0]);
      box([1.34,2.13,.79],[.7,1.33,.12],'091827');box([1.34,2.13,.863],[.6,1.18,.018],'1b6f86',U,1);
      const accent=phase==='page'?'edb672':phase==='outcome'?'87b6cb':'59e0c5';
      box([1.34,2.39,.88],[.47,.26,.012],accent,U,1);box([1.34,2.12,.88],[.45,.10,.012],'a6d2d4');box([1.30,1.96,.88],[.37,.06,.012],'6b9cac');
      box([1.34,2.70,.89],[.19,.028,.012],'091827');box([1.34,1.60,.89],[.2,.02,.012],'a6d2d4');
    }
    // ---- scenes
    function qrParking(){
      box([0,-.17,0],[11,.3,8.2],L.base);box([0,.0,0],[10.6,.035,7.8],L.floor);
      for(let i=-3;i<=3;i++)box([-1.2+i*1.5,.03,-2.4],[.07,.01,2.2],'8fa3bf');
      box([0,.03,-1.3],[10,.01,.07],'8fa3bf');
      // pay station with a QR sticker
      box([-.4,1.2,-1.6],[1.0,2.4,.75],'2b4b6e');box([-.4,1.75,-1.2],[.7,.5,.04],'0d4a66',U,1);box([-.4,2.55,-1.6],[1.1,.14,.85],'22d3ff',U,1);
      box([-.4,1.05,-1.19],[.62,.62,.03],'e8f1ff');
      let seed=11;const bit=()=>{seed=(seed*1103515245+12345)>>>0;return (seed>>16)&1;};
      for(let r=0;r<5;r++)for(let c=0;c<5;c++)if(bit()||(r%4===0&&c%4===0))box([-.62+c*.11,.83+r*.11,-1.17],[.09,.09,.02],'0b1220');
      box([-.4,.45,-1.19],[.7,.12,.03],'f5b84b',U,1);
      // bollard that carries the phone
      cylinder([1.34,.75,.74],.32,1.5,'3a4658');cylinder([1.34,1.5,.74],.36,.06,'22d3ff',24,1);
      // car with glowing lights
      box([-3.2,.55,-.2],[2.8,.7,1.4],'5a6b84');box([-3.2,1.08,-.2],[1.5,.5,1.2],'4a5a73');box([-3.2,1.08,-.2],[1.3,.38,1.24],'1b3a52',U,1);
      for(const x of [-4.3,-2.1])for(const z of [-.85,.45])box([x,.3,z],[.55,.55,.2],'0b1220');
      box([-1.78,.6,-.55],[.06,.14,.25],'fff1b8',U,1);box([-1.78,.6,.15],[.06,.14,.25],'fff1b8',U,1);
      // lamp post and barrier
      cylinder([3.4,1.9,-1.8],.08,3.8,'6b7a90');box([3.0,3.8,-1.8],[.9,.1,.3],'f5e6a8',U,1);
      box([3.3,.55,1.8],[.14,1.1,.14],'8fa3bf');box([1.6,1.0,1.8],[3.4,.1,.1],'ff4d6d',U,1);
      box([3.9,2.3,-.4],[.06,1.1,1.1],'1d4ed8');box([3.88,2.3,-.4],[.02,.5,.4],'e8f1ff');
    }
    const scenes={
      'blocked-card'(){shell();windowLeft();wallScreen();desk();drawers();paper(.25,.85);laptop();lamp();stool();plant();shelf();
        box([.6,1.545,1.12],[.55,.03,.34],'ff4d6d',U,1);box([.5,1.565,1.12],[.12,.012,.09],'f5e6a8');box([.72,1.565,1.12],[.2,.012,.03],'1a0f1c');},
      'safe-transfer'(){shell();windowLeft('e0a73a');wallScreen('4a3a10','f5b84b');desk('a58a6a','5b4a3b');drawers();laptop('c99a30');lamp();stool();plant();
        box([3.3,.62,1.6],[1.2,1.24,1.1],'4a5a70');box([3.3,.62,2.17],[1.0,1.04,.04],'62748e');box([3.7,.72,2.2],[.14,.14,.05],'f5b84b',U,1);box([3.1,.72,2.2],[.07,.28,.05],'a9b8cc');
        coins(.9,1.15);shelf();},
      'ordinary-receipt'(){shell();windowLeft('4fd1a5');
        box([.2,2.9,-3.16],[3.4,1.2,.12],'0b1d2d');box([.2,2.9,-3.08],[3.16,.98,.03],'0f5a4a',U,1);for(let i=0;i<5;i++)box([-1+i*.7,2.9,-3.05],[.5,.2,.02],'3ddc97',U,1);
        desk('d9c7a5','7a6a55');drawers();paper(.2,.9,'f4f3e8');cup(-.2,.4);cup(2.0,.3,'e8c7a1');lamp('ffe9b3');plant();
        parcel(-3.0,.35,1.0,.8,.7,.55,'3ddc97');parcel(-2.1,.3,1.6,.6,.6,.5,'f5b84b');shelf();
        box([.55,1.7,.25],[.12,.38,.03],'f4f3e8');},
      'qr-parking':qrParking,
      'relative-transfer'(){shell();
        for(let i=0;i<3;i++){box([-1.3+i*1.4,3.1-(i%2)*.25,-3.18],[.9,.7,.05],'e8c1a0');box([-1.3+i*1.4,3.1-(i%2)*.25,-3.14],[.74,.54,.03],['ff9aa2','8fd3ff','ffd98a'][i],U,1);}
        windowLeft('6bb8e8');desk('c9a27c','6b4f3a');drawers();paper(.2,.9,'f4f0e0');cup(-.2,.4,'ffd98a');lamp('ffd2a0');plant();shelf();
        box([-2.8,.55,-1.9],[3.0,.7,1.3],'6a4c93');box([-2.8,1.15,-2.45],[3.0,1.1,.3],'5a3f80');for(let i=0;i<3;i++)box([-3.7+i*.9,.95,-1.7],[.6,.4,.5],['8b5cf6','25d366','f5b84b'][i],[0,.3,0]);
        box([.6,1.57,1.2],[.5,.05,.4],'25d366',U,1);},
      'bank-call'(){shell();windowLeft('1b3a6b');
        box([.2,3.2,-3.16],[1.2,1.2,.1],'0b1d2d');box([.2,3.2,-3.1],[1.0,1.0,.04],'e8f1ff');box([.2,3.35,-3.07],[.05,.35,.03],'ff4d6d',U,1);box([.32,3.2,-3.07],[.28,.05,.03],'ff4d6d',U,1);
        desk('8a7a68','4a4136');drawers();laptop('7a2b3d');lamp('ff9aa8');plant();shelf();
        box([-.3,1.62,.95],[.8,.14,.55],'1b2230');box([-.3,1.78,.95],[.9,.12,.2],'2a3446',[0,.1,.35]);box([-.62,1.7,.8],[.14,.1,.14],'ff4d6d',U,1);
        box([.3,1.62,1.35],[.18,.18,.18],'ff4d6d',U,1);},
      'marketplace-prepay'(){shell();
        for(let i=0;i<3;i++)box([-1.8+i*1.4,2.6,-3.12],[.9,1.2,.05],'f5b84b');
        desk('c8b79a','6b5a46');drawers();paper(.25,.9);lamp();
        parcel(-3.0,.45,-1.2,1.1,.9,.9);parcel(-3.0,1.3,-1.2,.9,.8,.8,'b98d54');parcel(-2.0,.4,-2.2,.9,.8,.9);parcel(3.0,.4,-1.0,1.2,.8,1.0);parcel(3.1,1.15,-1.0,.8,.7,.8,'b98d54');
        box([-3.3,.9,1.6],[.2,1.5,1.9],'1b2230');box([-3.19,.9,1.6],[.03,1.3,1.7],'7a5a1a',U,1);box([-3.1,1.95,1.6],[.06,.34,.8],'f5b84b',U,1);
        box([.25,1.55,1.3],[.8,.05,.5],'a9b8cc');cylinder([.25,1.62,1.3],.12,.1,'3ddc97',16,1);},
      'fake-job'(){shell();windowLeft('8b5cf6');
        box([.2,2.9,-3.16],[3.8,1.8,.12],'0b1d2d');box([.2,2.9,-3.08],[3.56,1.58,.03],'2b1f5c',U,1);
        for(let i=0;i<3;i++)box([-.9+i*.85,2.55+i*.32,-3.04],[.5,.5+i*.6,.02],'f5b84b',U,1);box([1.2,3.3,-3.04],[.9,.1,.02],'8b5cf6',U,1);box([1.2,3.05,-3.04],[.7,.1,.02],'8b5cf6',U,1);
        desk('a4a9b8','4a4f60');drawers();laptop('4a2fa0');coins(.9,1.15);paper(.25,.85,'f4f3e8');lamp();plant();shelf();stool('8b5cf6');}
    };
    (scenes[id]||scenes['blocked-card'])();
    phoneRig();
    // Neon edges (pulse) in the scene colour, and a dashed radar ring on the floor (sweep highlight).
    const n1=L.neon,n2=L.neon2;
    if(id==='qr-parking'){
      box([0,.05,3.9],[10.6,.03,.04],n1,U,1);box([-5.3,.05,0],[.04,.03,7.8],n1,U,1);box([5.3,.05,0],[.04,.03,7.8],n2,U,1);box([0,.05,-3.9],[10.6,.03,.04],n2,U,1);
    }else{
      box([0,.05,3.22],[8.5,.03,.04],n1,U,1);box([-4.22,.05,-.05],[.04,.03,6.4],n1,U,1);box([0,.05,-3.2],[8.5,.03,.04],n2,U,1);
      box([-4.25,4.14,-.05],[.05,.05,6.5],n1,U,1);box([0,4.14,-3.24],[8.6,.05,.05],n1,U,1);
      box([.2,1.535,1.46],[5.1,.03,.03],n1,U,1);
    }
    box([1.34,1.5,.74],[.75,.02,.55],n1,U,1);
    for(let i=0;i<64;i+=2){const th=i/64*Math.PI*2;box([Math.cos(th)*3.1,.08,.3+Math.sin(th)*3.1],[.3,.012,.05],'22d3ff',[0,-Math.PI/2-th,0],2);}
    for(let i=0;i<40;i++){const th=i/40*Math.PI*2;box([Math.cos(th)*1.9,.075,.3+Math.sin(th)*1.9],[.1,.01,.04],n2,[0,-Math.PI/2-th,0],1);}
    return new Float32Array(vertices);
  }
  function create(canvas,{project,onAvailability}){
    let story='blocked-card',gl,program,buffer,positionLoc,normalLoc,colorLoc,glowLoc,matrixLoc,timeLoc,count=0,frame=0,active=false,phase='notification',yaw=.57,pitch=.43,distance=11.8,drag=null,lost=false,last=0,rcLoc=null,pProgram=null,pBuffer=null,pPosLoc=0,pMatLoc=null,pTimeLoc=null,pScaleLoc=null,pCount=0;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    function shader(type,source){const s=gl.createShader(type);if(!s)throw Error('shader');gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw Error('compile');}return s;}
    function upload(){canvas.dataset.scene=story;const data=geometry(phase,story);count=data.length/10;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);}
    // Floating glowing motes ("data dust"). Purely decorative: skipped for reduced motion, fewer on small canvases.
    function particles(){
      try{
        const vs=shader(gl.VERTEX_SHADER,'attribute vec4 a;uniform mat4 m;uniform float t;uniform float k;varying float s;void main(){s=a.w;float y=mod(a.y+t*(.10+.14*a.w),3.7)+.25;vec3 q=vec3(a.x+sin(t*.5+a.w*6.283)*.18,y,a.z+cos(t*.4+a.w*5.0)*.18);gl_Position=m*vec4(q,1.0);gl_PointSize=k*(1.2+2.2*a.w)/gl_Position.w;}');
        const fs=shader(gl.FRAGMENT_SHADER,'precision mediump float;varying float s;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.05,d);vec3 c=mix(vec3(.13,.83,1.),vec3(.55,.36,.96),step(.72,s));gl_FragColor=vec4(c*a,a);}');
        pProgram=gl.createProgram();gl.attachShader(pProgram,vs);gl.attachShader(pProgram,fs);gl.linkProgram(pProgram);gl.deleteShader(vs);gl.deleteShader(fs);
        if(!gl.getProgramParameter(pProgram,gl.LINK_STATUS))throw Error('link');
        pPosLoc=gl.getAttribLocation(pProgram,'a');pMatLoc=gl.getUniformLocation(pProgram,'m');pTimeLoc=gl.getUniformLocation(pProgram,'t');pScaleLoc=gl.getUniformLocation(pProgram,'k');
        let seed=7;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
        pCount=innerWidth<760?36:90;const data=new Float32Array(pCount*4);
        for(let i=0;i<pCount;i++){data.set([(rand()-.5)*8,rand()*3.7,(rand()-.5)*6,rand()],i*4);}
        pBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
      }catch(_){pProgram=null;pCount=0;}
    }
    function setup(){
      try{
        gl=canvas.getContext('webgl',{antialias:true});if(!gl)throw Error('webgl');
        const vertex=shader(gl.VERTEX_SHADER,'attribute vec3 p;attribute vec3 n;attribute vec3 c;attribute float g;uniform mat4 m;varying vec3 color;varying vec3 w;varying float k;void main(){float l=0.55+0.45*max(dot(normalize(n),normalize(vec3(0.4,0.9,0.65))),0.0);color=c*l;w=p;k=g;gl_Position=m*vec4(p,1.0);}');
        const fragment=shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 color;varying vec3 w;varying float k;uniform float t;uniform vec3 rc;void main(){vec3 c=color*vec3(.78,.92,1.12);if(k>1.5){float a=atan(w.z-.3,w.x);float s=fract((a-t*1.3)/6.2832);float i=pow(1.0-s,5.0);c=rc*(.22+1.7*i);}else if(k>.5){c+=color*(.35+.35*sin(t*2.0+w.x*1.3+w.z*.7));}gl_FragColor=vec4(c,1.0);}');
        program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('link');
        buffer=gl.createBuffer();positionLoc=gl.getAttribLocation(program,'p');normalLoc=gl.getAttribLocation(program,'n');colorLoc=gl.getAttribLocation(program,'c');glowLoc=gl.getAttribLocation(program,'g');matrixLoc=gl.getUniformLocation(program,'m');timeLoc=gl.getUniformLocation(program,'t');rcLoc=gl.getUniformLocation(program,'rc');
        particles();upload();lost=false;canvas.dataset.render='webgl';onAvailability(true);request();
      }catch(_){canvas.dataset.render='fallback';onAvailability(false);}
    }
    function draw(now){
      frame=0;if(!active||document.hidden||!gl||lost||canvas.dataset.render!=='webgl')return;
      const animate=!reduced.matches;
      if(animate&&now-last<33){request();return;}
      last=now||0;
      const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;
      const ratio=Math.min(window.devicePixelRatio||1,2,1600/width,1200/height),w=Math.round(width*ratio),h=Math.round(height*ratio);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);const look=lookOf(story);gl.clearColor(look.bg[0],look.bg[1],look.bg[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      for(const [loc,offset,size] of [[positionLoc,0,3],[normalLoc,12,3],[colorLoc,24,3],[glowLoc,36,1]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,40,offset);}
      gl.uniform1f(timeLoc,animate?(now||0)/1000:0);gl.uniform3fv(rcLoc,look.radar);
      const target=[0,1.35,0],eye=[Math.sin(yaw)*Math.cos(pitch)*distance,1.35+Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance];
      const m=multiply(perspective(w/h),lookAt(eye,target));gl.uniformMatrix4fv(matrixLoc,false,m);gl.drawArrays(gl.TRIANGLES,0,count);
      if(animate&&pProgram){
        for(const loc of [positionLoc,normalLoc,colorLoc,glowLoc])gl.disableVertexAttribArray(loc);
        gl.useProgram(pProgram);gl.bindBuffer(gl.ARRAY_BUFFER,pBuffer);gl.enableVertexAttribArray(pPosLoc);gl.vertexAttribPointer(pPosLoc,4,gl.FLOAT,false,16,0);
        gl.uniformMatrix4fv(pMatLoc,false,m);gl.uniform1f(pTimeLoc,(now||0)/1000);gl.uniform1f(pScaleLoc,h*.034);
        gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.depthMask(false);gl.drawArrays(gl.POINTS,0,pCount);gl.depthMask(true);gl.disable(gl.BLEND);gl.disableVertexAttribArray(pPosLoc);
        canvas.dataset.particles=String(pCount);
      }else delete canvas.dataset.particles;
      const p=[1.34,2.25,.9,1],q=[0,0,0,0];for(let row=0;row<4;row++)for(let col=0;col<4;col++)q[row]+=m[col*4+row]*p[col];
      project({x:clamp((q[0]/q[3]+1)*50,8,92),y:clamp((1-q[1]/q[3])*50,15,85)});
      if(animate)request();
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
    return {move,reset,setStory(value){if(story===value)return;story=value;if(gl&&!lost&&canvas.dataset.render==='webgl')upload();request();},setPhase(value){if(phase===value)return;phase=value;if(gl&&!lost&&canvas.dataset.render==='webgl')upload();request();},setActive(value){active=value;canvas.dataset.active=String(value);if(value)request();else{cancelAnimationFrame(frame);frame=0;drag=null;}},get active(){return active;}};
  }
  return {create};
})();
