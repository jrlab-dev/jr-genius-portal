import * as THREE from './vendor/three.module.js';
import {createFocusedPreview} from './focused-preview.js';

// One corridor + one rotunda. Coordinates are metres; the eye height never bobs.
const HALL_Z=-5, HALL_R=10.5, EYE=1.72;
export const exhibits=[
 {id:0,x:-3.15,z:16,rot:Math.PI/2,approach:[-.1,16],color:0x79bfff},
 {id:1,x:3.15,z:11,rot:-Math.PI/2,approach:[.1,11],color:0xb6db79},
 {id:2,x:-6.95,z:-11.95,rot:Math.PI/4,approach:[-4,-9],color:0x72e7db},
 {id:3,x:6.95,z:-11.95,rot:-Math.PI/4,approach:[4,-9],color:0xf4bd72}
];
export function validPosition(x,z){const inside=(Math.abs(x)<=3.02&&z>=3.5&&z<=23.1)||Math.hypot(x,z-HALL_Z)<=HALL_R-.65;if(!inside)return false;return exhibits.every(d=>{const dx=x-d.x,dz=z-d.z;const front=dx*Math.sin(d.rot)+dz*Math.cos(d.rot),side=dx*Math.cos(d.rot)-dz*Math.sin(d.rot);return Math.abs(side)>1.65||front>=.6})}
export async function createRoom({canvas,labels,select,reduced,onError,onTourChange=()=>{}}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x07111e);scene.fog=new THREE.Fog(0x0c1727,23,55);
 const camera=new THREE.PerspectiveCamera(65,1,.08,90);camera.position.set(0,EYE,21.5);camera.rotation.order='YXZ';
 let yaw=0,pitch=0,targetYaw=0,targetPitch=0,visible=true,disposed=false,frame=0,last=0,selected=-1,returnPose=null,drag=null,suppressClickUntil=0,renderCount=0;
 let touring=false,tourElapsed=0;
 function endTour(){if(!touring)return;touring=false;onTourChange(false)}
 const moving={f:0,b:0,l:0,r:0};const keys=new Set();const loader=new THREE.TextureLoader();
 const [hall,art,ceiling]=await Promise.all([loader.loadAsync('assets/hall.webp'),loader.loadAsync('assets/portals.webp'),loader.loadAsync('assets/ceiling.webp')]);
 [hall,art].forEach(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy())});
 const gold=new THREE.MeshStandardMaterial({color:0xb08a4d,metalness:.76,roughness:.34});
 const oldgold=new THREE.MeshStandardMaterial({color:0x54432b,metalness:.65,roughness:.42});
 const navy=new THREE.MeshStandardMaterial({color:0x1a2b40,metalness:.3,roughness:.48});
 const ink=new THREE.MeshStandardMaterial({color:0x101d30,roughness:.65});
 const glow=new THREE.MeshBasicMaterial({color:0xffd490});
 scene.add(new THREE.HemisphereLight(0xa9c8ff,0x6e512b,2.5));const sun=new THREE.DirectionalLight(0xffd6a3,3);sun.position.set(-3,10,15);scene.add(sun);const blue=new THREE.DirectionalLight(0x679bff,1.5);blue.position.set(8,8,-15);scene.add(blue);
 function mesh(geo,mat,x,y,z,rx=0,ry=0,rz=0,parent=scene){const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);parent.add(o);return o}
 function box(w,h,d,mat,x,y,z,parent=scene){return mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z,0,0,0,parent)}
 // Procedural marble is code-generated, not a replacement for the supplied artwork.
 const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');ctx.fillStyle='#101f31';ctx.fillRect(0,0,1024,1024);let seed=37;const rnd=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646};
 for(let i=0;i<95;i++){ctx.beginPath();let x=rnd()*1200-80,y=rnd()*1024;ctx.moveTo(x,y);for(let j=0;j<12;j++){x+=rnd()*100-22;y+=rnd()*120-55;ctx.lineTo(x,y)}ctx.strokeStyle=i%5===0?'#bd91514a':'#8ca0b51d';ctx.lineWidth=i%5===0?1.5:.6;ctx.stroke()}
 for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(i*256,0);ctx.lineTo(i*256,1024);ctx.moveTo(0,i*256);ctx.lineTo(1024,i*256);ctx.strokeStyle='#b1966052';ctx.lineWidth=1;ctx.stroke()}
 const marble=new THREE.CanvasTexture(c);marble.wrapS=marble.wrapT=THREE.RepeatWrapping;marble.repeat.set(7,12);marble.colorSpace=THREE.SRGBColorSpace;
 mesh(new THREE.PlaneGeometry(45,65),new THREE.MeshStandardMaterial({map:marble,color:0xc8d2e0,metalness:.28,roughness:.55}),0,-.015,0,-Math.PI/2);
 // A narrow velvet runner stays above the marble/inlays and ends at the rotunda threshold.
 // It is visual geometry only: never part of pointer targets or collision rules.
 const weave=document.createElement('canvas');weave.width=weave.height=128;const wc=weave.getContext('2d');wc.fillStyle='#761a2d';wc.fillRect(0,0,128,128);
 for(let y=0;y<128;y+=2){wc.fillStyle=y%4?'#7c2031':'#70172a';wc.fillRect(0,y,128,1)}
 const velvet=new THREE.CanvasTexture(weave);velvet.colorSpace=THREE.SRGBColorSpace;velvet.wrapS=velvet.wrapT=THREE.RepeatWrapping;velvet.repeat.set(3,28);
 mesh(new THREE.PlaneGeometry(2.15,19.2),new THREE.MeshStandardMaterial({map:velvet,roughness:1,metalness:0}),0,.034,13.8,-Math.PI/2);
 const binding=new THREE.MeshStandardMaterial({color:0xa07943,roughness:.85,metalness:.08});
 for(const x of [-1.035,1.035])mesh(new THREE.PlaneGeometry(.026,19.2),binding,x,.037,13.8,-Math.PI/2);
 for(const z of [4.23,23.37])mesh(new THREE.PlaneGeometry(2.08,.026),binding,0,.037,z,-Math.PI/2);
 // Gold floor inlays and the circular compass establish real perspective while walking.
 for(const radius of [2.1,2.18,4.7,4.74,9.7])mesh(new THREE.RingGeometry(radius,radius+.025,96),gold,0,.009,HALL_Z,-Math.PI/2);
 for(let i=0;i<16;i++){const g=new THREE.Shape();g.moveTo(0,0);g.lineTo(-.12,1.1);g.lineTo(0,i%2?1.7:2);g.lineTo(.12,1.1);g.closePath();mesh(new THREE.ShapeGeometry(g),i%2?oldgold:gold,0,.013,HALL_Z,-Math.PI/2,0,i*Math.PI/8)}
 for(const x of [-2.9,2.9])box(.018,.012,20,gold,x,.013,14);
 // Rotunda walls are a real curved surface with an opening facing the corridor.
 const wallTexture=hall.clone();wallTexture.needsUpdate=true;wallTexture.offset.set(.08,.25);wallTexture.repeat.set(2.9,.75);wallTexture.wrapS=THREE.RepeatWrapping;
 mesh(new THREE.CylinderGeometry(HALL_R,HALL_R,9.5,96,1,true,.34,Math.PI*2-.68),new THREE.MeshBasicMaterial({map:wallTexture,side:THREE.BackSide,color:0xb5bed1}),0,4.75,HALL_Z);
 // Three-dimensional skirting and gallery balconies follow the round wall.
 for(const y of [.18,.43,5.25,5.48,7.7]){const curve=new THREE.CatmullRomCurve3(Array.from({length:100},(_,i)=>{const a=.35+i/99*(Math.PI*2-.7);return new THREE.Vector3(Math.sin(a)*(HALL_R-.11),y,HALL_Z+Math.cos(a)*(HALL_R-.11))}));scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve,100,.035,6,false),gold))}
 const stars=ceiling;stars.colorSpace=THREE.SRGBColorSpace;mesh(new THREE.SphereGeometry(HALL_R,64,32,0,Math.PI*2,0,Math.PI/2),new THREE.MeshBasicMaterial({map:stars,side:THREE.DoubleSide}),0,7.6,HALL_Z);
 function column(x,z,h=5.5){const pts=[[.37,0],[.37,.12],[.3,.17],[.28,.3],[.2,.45],[.18,h-.5],[.28,h-.35],[.34,h-.22],[.37,h-.17],[.37,h]].map(([a,b])=>new THREE.Vector2(a,b));mesh(new THREE.LatheGeometry(pts,20),navy,x,0,z);for(const y of [.14,.3,h-.35,h-.12])mesh(new THREE.TorusGeometry(y<1?.3:.34,.026,6,24),gold,x,y,z,Math.PI/2);for(let j=0;j<8;j++){const a=j*Math.PI/4;box(.018,h-1,.018,oldgold,x+Math.sin(a)*.185,h/2,z+Math.cos(a)*.185)}}
 function lamp(x,z,y=3.3){box(.13,.5,.2,oldgold,x,y,z);mesh(new THREE.SphereGeometry(.085,12,8),glow,x,y+.17,z+.08);const halo=mesh(new THREE.SphereGeometry(.17,12,8),new THREE.MeshBasicMaterial({color:0xffb34c,transparent:true,opacity:.12,depthWrite:false}),x,y+.17,z+.08);return halo}
 for(let i=1;i<16;i++){if(i===6||i===10)continue;const a=i/16*Math.PI*2;column(Math.sin(a)*10.05,HALL_Z+Math.cos(a)*10.05,7.6);lamp(Math.sin(a)*9.92,HALL_Z+Math.cos(a)*9.92,4.05)}
 // Corridor side walls: texture plus sculpted ribs, foot rails, ceiling arches, and lamps.
 const corridorTexture=hall.clone();corridorTexture.needsUpdate=true;corridorTexture.offset.set(0,.24);corridorTexture.repeat.set(1,.5);const wallMat=new THREE.MeshBasicMaterial({map:corridorTexture,color:0xa6b3cc});
 for(const x of [-3.65,3.65]){const wall=mesh(new THREE.PlaneGeometry(20,5.7),wallMat,x,2.85,14,0,x>0?-Math.PI/2:Math.PI/2);for(const y of [.15,.38,4.65,5.1])box(.34,.035,20,gold,x,y,14);for(let z=5;z<25;z+=4){column(x>0?3.42:-3.42,z,5.5);lamp(x>0?3.3:-3.3,z,3.5)}}
 function archShape(w,h){const s=new THREE.Shape();const r=w/2;s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,h-r);s.absarc(0,h-r,r,0,Math.PI,false);s.lineTo(-r,0);return s}
 function archFrame(w,h,t,depth,mat,parent){const s=archShape(w+2*t,h+t);const hole=archShape(w,h);s.holes.push(new THREE.Path(hole.getPoints(40)));const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.018,bevelThickness:.018,curveSegments:32});return mesh(g,mat,0,0,0,0,0,0,parent)}
 for(let z=5;z<25;z+=4){const a=new THREE.Group();a.position.set(0,0,z);scene.add(a);archFrame(6.8,6.8,.1,.12,oldgold,a)}
 // Corridor roof is a dark real barrel vault, not an open ceiling or a box.
 const vaultGeo=new THREE.CylinderGeometry(3.55,3.55,20,48,1,true,0,Math.PI);vaultGeo.rotateZ(Math.PI/2);vaultGeo.rotateY(Math.PI/2);const vault=mesh(vaultGeo,new THREE.MeshBasicMaterial({map:stars,side:THREE.DoubleSide,color:0xa5c8ff}),0,3.3,14);
 // Central hanging astronomical sculpture: real rings give a visible changing silhouette.
 const sphereGroup=new THREE.Group();sphereGroup.position.set(0,6.2,HALL_Z);scene.add(sphereGroup);
 for(let i=0;i<4;i++){const r=mesh(new THREE.TorusGeometry(1.4+i*.2,.025,8,80),gold,0,0,0,.5+i*.6,i*.7,0,sphereGroup)}mesh(new THREE.SphereGeometry(.17,16,12),gold,0,0,0,0,0,0,sphereGroup);box(.025,3,.025,gold,0,8,HALL_Z);
 const targets=[],anchors=[];
 exhibits.forEach((d,i)=>{const group=new THREE.Group();group.position.set(d.x,.1,d.z);group.rotation.y=d.rot;scene.add(group);const w=2.55,h=4.05;
  archFrame(w+.1,h+.05,.19,.31,navy,group);archFrame(w,h,.06,.38,gold,group);
  const inner=archShape(w,h);const geo=new THREE.ShapeGeometry(inner,40);const pos=geo.attributes.position;const uv=geo.attributes.uv;for(let k=0;k<pos.count;k++)uv.setXY(k,(i+(pos.getX(k)+w/2)/w)/4,pos.getY(k)/h);uv.needsUpdate=true;
  const panel=mesh(geo,new THREE.MeshBasicMaterial({map:art,side:THREE.DoubleSide}),0,0,-.2,0,0,0,group);panel.userData.id=i;targets.push(panel);
  const recess=archFrame(w+.12,h+.1,.15,.65,ink,group);recess.position.z=-.27;
  box(w+.5,.12,.8,oldgold,0,-.04,.05,group);box(w+.38,.045,.72,gold,0,.045,.04,group);
  for(const x of [-w/2-.12,w/2+.12]){for(const y of [.3,.55,2.65])box(.18,.06,.5,gold,x,y,.19,group);mesh(new THREE.SphereGeometry(.055,12,8),new THREE.MeshBasicMaterial({color:d.color}),x,2.8,.44,0,0,0,group)}
  // Brass finial and floor light are sculpted objects, not painted UI.
  mesh(new THREE.OctahedronGeometry(.12),gold,0,h+.23,.18,0,0,0,group);
  const anchor=new THREE.Object3D();anchor.position.set(0,3.25,.5);group.add(anchor);anchors.push(anchor);
 });
 function canvasInView(){const r=canvas.getBoundingClientRect();const w=Math.max(0,Math.min(r.right,innerWidth)-Math.max(r.left,0)),h=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));return r.width*r.height>0&&w*h/(r.width*r.height)>=.25}
 let inViewport=true;
 const preview=createFocusedPreview({targets,wake,allowed:()=>inViewport&&visible&&!disposed&&!reduced&&!document.hidden});
 const io=new IntersectionObserver(entries=>{inViewport=canvasInView();if(!inViewport)preview.stop();wake()},{threshold:[0,.25]});io.observe(canvas);
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const hallTarget=new THREE.Mesh(new THREE.PlaneGeometry(5.8,4.8),new THREE.MeshBasicMaterial());hallTarget.position.set(0,2.4,4);hallTarget.updateMatrixWorld();
 function wake(){if(!frame&&visible&&!disposed)frame=requestAnimationFrame(tick)}
 function pose(){return{x:camera.position.x,z:camera.position.z,yaw:targetYaw,pitch:targetPitch}}
 function applyPose(p){camera.position.set(p.x,EYE,p.z);yaw=targetYaw=p.yaw;pitch=targetPitch=p.pitch??0;wake()}
 function look(amount){if(touring)return;targetYaw-=amount;if(reduced)yaw=targetYaw;wake()}
 function resize(){const r=canvas.parentElement.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.fov=r.width<650?72:65;camera.updateProjectionMatrix();wake()}
 function move(dx,dz){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));for(let i=0;i<steps;i++){const x=camera.position.x+dx/steps,z=camera.position.z+dz/steps;if(validPosition(x,camera.position.z))camera.position.x=x;if(validPosition(camera.position.x,z))camera.position.z=z}wake()}
 function tick(t){frame=0;if(disposed||!visible)return;const dt=Math.min(.045,last?(t-last)/1000:.016);last=t;if(touring){tourElapsed+=dt;const u=Math.min(1,tourElapsed/8),e=u*u*u*(u*(u*6-15)+10);camera.position.set(0,EYE,21.5-20*e);yaw=targetYaw=0;pitch=targetPitch=.06*e;if(u===1)endTour()}const f=(moving.f||keys.has('w')?1:0)-(moving.b||keys.has('s')?1:0),side=(moving.r||keys.has('d')?1:0)-(moving.l||keys.has('a')?1:0);if(!touring&&(f||side)){const norm=Math.hypot(f,side),speed=reduced?1.35:2.25;move((-Math.sin(yaw)*f+Math.cos(yaw)*side)/norm*speed*dt,(-Math.cos(yaw)*f-Math.sin(yaw)*side)/norm*speed*dt);suppressClickUntil=performance.now()+180}
  const ay=targetYaw-yaw,ap=targetPitch-pitch;if(reduced){yaw=targetYaw;pitch=targetPitch}else{yaw+=ay*.24;pitch+=ap*.24}camera.rotation.set(pitch,yaw,0,'YXZ');camera.updateMatrixWorld();
  anchors.forEach((a,i)=>{const world=new THREE.Vector3();a.getWorldPosition(world);const distance=world.distanceTo(camera.position);const projected=world.clone().project(camera);const toward=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),exhibits[i].rot);const front=camera.position.clone().sub(world).dot(toward)>0;const r=canvas.getBoundingClientRect();const x=(projected.x*.5+.5)*r.width,y=(-projected.y*.5+.5)*r.height;const show=front&&projected.z<1&&distance<16&&x>65&&x<r.width-65&&y>135&&y<r.height-35;labels[i].style.display=show?'block':'none';if(show){labels[i].style.left=x+'px';labels[i].style.top=y+'px'}});
  inViewport=canvasInView();const previewActive=preview.tick(camera);renderer.render(scene,camera);renderCount++;if(touring||previewActive||f||side||Math.abs(ay)>.0005||Math.abs(ap)>.0005)wake();
 }
 function onDown(e){if(e.button!==undefined&&e.button!==0)return;canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,total:0,start:performance.now()}}
 function onMove(e){if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.total+=Math.hypot(dx,dy);drag.x=e.clientX;drag.y=e.clientY;if(touring)return;targetYaw-=dx*.0033;targetPitch=THREE.MathUtils.clamp(targetPitch-dy*.002,-.3,.5);if(reduced){yaw=targetYaw;pitch=targetPitch}wake()}
 function onUp(e){if(!drag||drag.id!==e.pointerId)return;const wasDrag=drag.total>8;drag=null;if(wasDrag){suppressClickUntil=performance.now()+220;return}if(performance.now()<suppressClickUntil)return;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(targets)[0];const hallHit=camera.position.z>4.4?ray.intersectObject(hallTarget)[0]:null;if(hit&&hit.distance<17&&(!hallHit||hit.distance<hallHit.distance)){const d=exhibits[hit.object.userData.id];const normal=new THREE.Vector3(Math.sin(d.rot),0,Math.cos(d.rot));if(camera.position.clone().sub(new THREE.Vector3(d.x,0,d.z)).dot(normal)>0){select(hit.object.userData.id);return}}if(hallHit){api.hall();document.getElementById('hint').textContent='円形ホールに到着しました · 展示は1回で開きます'}}
 canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',()=>{drag=null});canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();onError('WebGL context lost')});
 const keydown=e=>{if(touring)return;if(/input|textarea|select/i.test(e.target.tagName)||e.ctrlKey||e.metaKey)return;const k=e.key.toLowerCase();if(['w','a','s','d'].includes(k)){e.preventDefault();keys.add(k);wake()}};const keyup=e=>keys.delete(e.key.toLowerCase());addEventListener('keydown',keydown);addEventListener('keyup',keyup);const stop=()=>{keys.clear();Object.keys(moving).forEach(k=>moving[k]=0);drag=null};addEventListener('blur',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();preview.stop();visible=false}else{visible=!document.body.classList.contains('list-mode');wake()}});
 document.querySelectorAll('[data-move]').forEach(b=>{const end=()=>{moving[b.dataset.move]=0};b.onpointerdown=e=>{e.preventDefault();if(touring)return;b.setPointerCapture(e.pointerId);moving[b.dataset.move]=1;suppressClickUntil=performance.now()+200;wake()};b.onpointerup=end;b.onpointercancel=end;b.onlostpointercapture=end});
 const ro=new ResizeObserver(resize);ro.observe(canvas.parentElement);resize();
 const api={look,resize,pose,cancelTour(){endTour();stop()},startTour(){if(reduced){this.hall();onTourChange(false);return}tourElapsed=0;touring=true;stop();applyPose({x:0,z:21.5,yaw:0,pitch:0});onTourChange(true)},restore(p){endTour();if(p&&[p.x,p.z,p.yaw,p.pitch].every(Number.isFinite)&&validPosition(p.x,p.z))applyPose(p)},setReduced(v){reduced=v;if(v){preview.stop();if(touring)this.hall()}yaw=targetYaw;pitch=targetPitch;wake()},setVisible(v){visible=v;if(!v){stop();preview.stop()}wake()},focus(i){endTour();if(returnPose===null)returnPose=pose();selected=i;const d=exhibits[i];applyPose({x:d.approach[0],z:d.approach[1],yaw:Math.atan2(-(d.x-d.approach[0]),-(d.z-d.approach[1])),pitch:.13})},reset(){if(returnPose){applyPose(returnPose);returnPose=null}else applyPose({x:0,z:21.5,yaw:0,pitch:0});selected=-1},hall(){endTour();stop();returnPose=null;selected=-1;applyPose({x:0,z:1.5,yaw:0,pitch:.06})},entrance(){endTour();stop();returnPose=null;selected=-1;applyPose({x:0,z:21.5,yaw:0,pitch:0})},dispose(){disposed=true;io.disconnect();preview.dispose();cancelAnimationFrame(frame);ro.disconnect();removeEventListener('keydown',keydown);removeEventListener('keyup',keyup);hallTarget.geometry.dispose();hallTarget.material.dispose();renderer.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose())}});velvet.dispose();hall.dispose();art.dispose();ceiling.dispose()}};
 api.debug={pose,validPosition,move,look,teleport(p){if(!validPosition(p.x,p.z))throw Error('unsafe debug pose');applyPose(p)},get preview(){return preview.stats},get stats(){return{touring,tourElapsed,renderCount,inViewport,frame,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,selected,reduced,visible,eye:camera.position.y}},hall:api.hall,entrance:api.entrance,dispose:api.dispose};wake();return api;
}
