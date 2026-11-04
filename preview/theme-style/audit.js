// 글자 대비 자동 측정(WCAG). 브라우저 콘솔/하네스에서 window.__A.audit(root,'태그') 로 사용한다. 운영 코드가 아니다.
window.__A=(function(){
const parseCss=s=>{let m;if(m=s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/)){const a=m[4]==null?1:(m[4].endsWith('%')?parseFloat(m[4])/100:+m[4]);return [+m[1],+m[2],+m[3],a];}
 if(m=s.match(/color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/)){const a=m[4]==null?1:(m[4].endsWith('%')?parseFloat(m[4])/100:+m[4]);return [m[1]*255,m[2]*255,m[3]*255,a];}
 if(m=s.match(/oklab\(\s*([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/)){const L=+m[1],A=+m[2],B=+m[3];const a=m[4]==null?1:(m[4].endsWith('%')?parseFloat(m[4])/100:+m[4]);const l_=L+.3963377774*A+.2158037573*B,m_=L-.1055613458*A-.0638541728*B,s_=L-.0894841775*A-1.291485548*B;const l=l_**3,mm=m_**3,ss=s_**3;const lr=[4.0767416621*l-3.3077115913*mm+.2309699292*ss,-1.2684380046*l+2.6097574011*mm-.3413193965*ss,-.0041960863*l-.7034186147*mm+1.707614701*ss];const f=c=>255*Math.min(1,Math.max(0,c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055));return [f(lr[0]),f(lr[1]),f(lr[2]),a];}
 return null;};
const colorsIn=s=>(s.match(/rgba?\([^)]*\)|color\(srgb[^)]*\)|oklab\([^)]*\)/g)||[]).map(parseCss).filter(Boolean);
const over=(t,b)=>{const a=t[3]+b[3]*(1-t[3]);if(a===0)return [0,0,0,0];return [0,1,2].map(i=>(t[i]*t[3]+b[i]*b[3]*(1-t[3]))/a).concat(a);};
const lum=([r,g,b])=>{const f=c=>{c/=255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4};return .2126*f(r)+.7152*f(g)+.0722*f(b);};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
function base(){const p=document.createElement('div');p.style.cssText='position:fixed;left:-9px;width:1px;height:1px;background:var(--lovelace-background,var(--primary-background-color,#fff))';document.body.append(p);const cs=getComputedStyle(p);const g=colorsIn(cs.backgroundImage);const bc=parseCss(cs.backgroundColor);p.remove();return g.length?[g[0],g[g.length-1]]:[bc||[255,255,255,1]];}
const TAGS=new Set(['SPAN','DIV','BUTTON','B','STRONG','SMALL','H1','H2','H3','H4','LABEL','A','P','I','LI','TD','TH','SELECT','OPTION']);
function audit(rootEl,tag,bases=base()){const res=[],seen={};const all=[...rootEl.querySelectorAll('*')];if(rootEl.nodeType===1)all.unshift(rootEl);
 for(const el of all){if(el.closest&&(el.closest('.leaflet-container')||el.closest('.carrot-floating-bubble')))continue;if(!TAGS.has(el.tagName))continue;let own='';el.childNodes.forEach(n=>{if(n.nodeType===3)own+=n.textContent;});own=own.trim();if(!own)continue;
  if(!el.getClientRects().length)continue;const cs=getComputedStyle(el);if(cs.visibility==='hidden'||+cs.opacity===0)continue;
  let cur=el,opaque=false;const layers=[];
  while(cur&&!opaque){const c=getComputedStyle(cur);const gi=colorsIn(c.backgroundImage||'');const bc=parseCss(c.backgroundColor||'');
   if(gi.length&&/gradient/.test(c.backgroundImage)){layers.push(gi.length>1?[gi[0],gi[gi.length-1]]:[gi[0]]);if(gi.every(x=>x[3]>=.99))opaque=true;}
   if(bc&&bc[3]>0){layers.push([bc]);if(bc[3]>=.99)opaque=true;}
   cur=cur.parentNode&&cur.parentNode.nodeType===11?cur.parentNode.host:cur.parentElement;if(cur&&cur.tagName==='HOME-ASSISTANT')cur=null;}
  let stack=bases.map(b=>[b]);for(let i=layers.length-1;i>=0;i--){const nx=[];for(const lay of layers[i])for(const s of stack)nx.push(over(lay,s[0]));stack=nx.map(x=>[x]);}
  const finals=stack.map(s=>s[0]);const fg=parseCss(cs.color);if(!fg)continue;let worst=99;for(const bg of finals){const f=over(fg,[bg[0],bg[1],bg[2],1]);worst=Math.min(worst,ratio(f,bg));}
  const fs=parseFloat(cs.fontSize),bold=+cs.fontWeight>=700;const need=(fs>=24||(fs>=18.66&&bold))?3:4.5;
  const sig0=tag+' '+el.tagName.toLowerCase()+'.'+String(el.className).trim().split(/\s+/).slice(0,2).join('.')+' ['+own.slice(0,16)+']';const n=(seen[sig0]=(seen[sig0]||0)+1);
  res.push({sig:n>1?sig0+' #'+n:sig0,ratio:+worst.toFixed(2),need,fail:worst<need});}
 return res;}
return {audit,base,parseCss};})();
