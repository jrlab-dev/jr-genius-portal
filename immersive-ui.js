// Explicit controls only: canvas taps remain reserved for the 3D scene.
(()=>{
 const room=document.getElementById('room'),panel=document.querySelector('.controls');
 panel.id='movement-panel';room.append(panel);
 const help=document.createElement('p');help.className='controls-help';help.textContent='↶ ↷ で見回す · 矢印は長押しで歩く';panel.prepend(help);
 const dock=document.createElement('div');dock.className='scene-dock';
 const toggle=document.createElement('button');toggle.id='controls-toggle';toggle.textContent='操作';toggle.setAttribute('aria-controls',panel.id);toggle.setAttribute('aria-expanded','false');
 const skip=document.createElement('button');skip.id='tour-skip';skip.textContent='ホールへスキップ';skip.onclick=()=>document.getElementById('skip-hall').click();dock.append(skip,toggle);room.append(dock);
 document.querySelector('[data-move=f]').textContent='↑';panel.querySelectorAll('button[aria-label]').forEach(b=>b.title=b.getAttribute('aria-label'));
 document.getElementById('look-left').textContent='↶';document.getElementById('look-right').textContent='↷';
 let opened=false,timer=0,keyboardInside=false;const pointers=new Set(),heldKeys=new Set();
 function arm(){clearTimeout(timer);if(opened&&!pointers.size&&!heldKeys.size&&!keyboardInside)timer=setTimeout(()=>setOpen(false),5000)}
 function setOpen(value){opened=!!value&&!document.body.classList.contains('auto-walking');panel.hidden=!opened;toggle.setAttribute('aria-expanded',String(opened));toggle.textContent=opened?'操作を閉じる':'操作';document.body.classList.toggle('controls-open',opened);arm()}
 toggle.onclick=()=>{keyboardInside=false;setOpen(!opened)};
 panel.addEventListener('pointerdown',e=>{keyboardInside=false;pointers.add(e.pointerId);arm()});
 addEventListener('pointerdown',e=>{if(opened&&e.target===document.getElementById('canvas')){pointers.add(e.pointerId);arm()}});
 addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight'].includes(e.code)){heldKeys.add(e.code);arm()}});addEventListener('keyup',e=>{heldKeys.delete(e.code);arm()});
 const release=e=>{pointers.delete(e.pointerId);arm()};addEventListener('pointerup',release);addEventListener('pointercancel',release);
 panel.addEventListener('focusin',()=>{keyboardInside=!pointers.size;arm()});panel.addEventListener('focusout',()=>{queueMicrotask(()=>{keyboardInside=panel.contains(document.activeElement);arm()})});
 panel.addEventListener('keydown',e=>{keyboardInside=true;arm();if(e.key==='Escape'){setOpen(false);toggle.focus()}});
 addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){setOpen(false);toggle.focus()}});
 addEventListener('blur',()=>{pointers.clear();heldKeys.clear();keyboardInside=false;arm()});
 window.addEventListener('gallery-phase',e=>{setOpen(false);toggle.hidden=e.detail.touring;skip.hidden=!e.detail.touring;document.body.classList.toggle('gallery-ready',true)});
 document.getElementById('list-toggle').addEventListener('click',()=>setOpen(false));
 setOpen(false);toggle.hidden=true;skip.hidden=true;
 window.immersiveUI={get opened(){return opened}};
})();
