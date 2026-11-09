(function(){var d=document.documentElement,tx=0,ty=0,cx=0,cy=0,on=false,run=false;
var still=matchMedia('(prefers-reduced-motion: reduce)').matches;
function step(){cx+=(tx-cx)*.18;cy+=(ty-cy)*.18;d.style.setProperty('--mx',cx.toFixed(1)+'px');d.style.setProperty('--my',cy.toFixed(1)+'px');
if(Math.abs(tx-cx)>.5||Math.abs(ty-cy)>.5){requestAnimationFrame(step)}else{run=false}}
function go(x,y){tx=x;ty=y;if(!on){cx=tx;cy=ty;on=true;d.classList.add('spot-on')}
if(still){cx=tx;cy=ty;d.style.setProperty('--mx',tx+'px');d.style.setProperty('--my',ty+'px');return}
if(!run){run=true;requestAnimationFrame(step)}}
addEventListener('pointermove',function(e){go(e.clientX,e.clientY)},{passive:true});
['touchstart','touchmove'].forEach(function(n){addEventListener(n,function(e){var t=e.touches[0];if(t)go(t.clientX,t.clientY)},{passive:true})});})();
