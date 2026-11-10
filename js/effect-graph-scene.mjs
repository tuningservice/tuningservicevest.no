import {axisLimit,displayNumber,curveSegments,GRAPH_NOTES} from './effect-graph-model.mjs';
import {brandLogoPath} from './vehicle-brand.mjs';
import {customerEngineName} from './vehicle-units.mjs';
import {customerHardwareText} from './customer-presentation.mjs';
const C={bg:'#111315',plot:'#171b1e',grid:'#384147',muted:'#c1cad1',text:'#f5f5f5',gold:'#e6bd65',tuning:'#3ddc97',original:'#b8c7d5',torque:'#65d7c2'};
const text=(s,x,y,value,size=12,fill=C.text,extra={})=>s.items.push({type:'text',x,y,text:String(value),size,fill,...extra});
const line=(s,x1,y1,x2,y2,stroke=C.grid,extra={})=>s.items.push({type:'line',x1,y1,x2,y2,stroke,...extra});
const rect=(s,x,y,width,height,fill,extra={})=>s.items.push({type:'rect',x,y,width,height,fill,...extra});
const scene=(width,height)=>({width,height,items:[]});
export function wrapText(value,max=82){const lines=[];let line='';for(const word of String(value).split(/\s+/)){if(line&&line.length+word.length+1>max){lines.push(line);line='';}if(word.length>max){if(line)lines.push(line);for(let i=0;i<word.length;i+=max)lines.push(word.slice(i,i+max));line='';}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;}
function watermark(s,x,y,w,h){rect(s,x,y,w,h,C.plot);const iw=Math.min(w*.62,420),ih=iw*87/380;s.items.push({type:'image',asset:'watermark',href:'/img/logo-transparent.png',x:x+(w-iw)/2,y:y+(h-ih)/2,width:iw,height:ih,opacity:.13});}
export function barScene(metric,stage,width=420,{compact=false}={}){
  const s=scene(width,compact?215:276),left=45,right=18,top=compact?50:60,bottom=compact?150:205,w=width-left-right,h=bottom-top,limit=axisLimit([metric.original,metric.tuned]);
  rect(s,0,0,width,s.height,C.bg,{rx:10});text(s,16,27,metric.label,16,C.text,{weight:600});text(s,width-18,27,metric.unit,12,C.gold,{anchor:'end'});watermark(s,left,top,w,h);
  for(let i=0;i<=4;i++){const value=limit*i/4,y=bottom-h*i/4;line(s,left,y,width-right,y);text(s,left-9,y+4,displayNumber(value),11,C.muted,{anchor:'end'});}line(s,left,bottom,width-right,bottom,C.muted);
  const bw=Math.min(84,w*.25);
  for(const [i,value,label,fill] of [[0,metric.original,'Original',C.original],[1,metric.tuned,stage,C.tuning]]){
    const x=left+w*(i===0?.28:.74),height=value===null?0:h*value/limit;
    if(value!==null){rect(s,x-bw/2,bottom-height,bw,height,fill);text(s,x,Math.max(top-10,bottom-height-10),displayNumber(value)+' '+metric.unit,12,C.text,{anchor:'middle',weight:600});}
    else{for(const [j,t] of ['Ikkje','oppgitt'].entries())text(s,x,top+55+j*17,t,12,C.muted,{anchor:'middle'});}
    text(s,x,bottom+23,label.length>18?'Valt alternativ':label,12,C.muted,{anchor:'middle'});
  }
  const increase=metric.increase===null?'Auke: Ikkje oppgitt':`Auke: ${metric.increase>0?'+':''}${displayNumber(metric.increase)} ${metric.unit}`;
  text(s,width/2,compact?202:260,increase,15,C.gold,{anchor:'middle',weight:600});return s;
}
function curveStyle(series){const tuned=series.ownership==='stage';return {color:tuned?(series.metric==='powerHk'?C.gold:C.torque):C.original,dash:tuned?null:series.metric==='powerHk'?'7 5':'2 5'};}
export function curveScene(model,width=850){
  const mobile=width<520,s=scene(width,mobile?380:370),left=47,right=47,top=45,bottom=mobile?272:270,w=width-left-right,h=bottom-top;
  const hp=model.curves.some(c=>c.metric==='powerHk'),nm=model.curves.some(c=>c.metric==='torqueNm');
  const limits={powerHk:axisLimit(model.curves.filter(c=>c.metric==='powerHk').flatMap(c=>c.points.map(p=>p.value))),torqueNm:axisLimit(model.curves.filter(c=>c.metric==='torqueNm').flatMap(c=>c.points.map(p=>p.value)))};
  const rpmMax=axisLimit(model.curves.flatMap(c=>c.points.map(p=>p.rpm))),x=r=>left+w*r/rpmMax,y=(v,m)=>bottom-h*v/limits[m];
  rect(s,0,0,width,s.height,C.bg,{rx:10});watermark(s,left,top,w,h);
  if(hp)text(s,left-8,24,'HK',12,C.gold,{anchor:'end',weight:600});if(nm)text(s,width-right+8,24,'Nm',12,C.torque,{weight:600});
  for(let i=0;i<=4;i++){const yy=bottom-h*i/4;line(s,left,yy,width-right,yy);if(hp)text(s,left-8,yy+4,displayNumber(limits.powerHk*i/4),11,C.muted,{anchor:'end'});if(nm)text(s,width-right+8,yy+4,displayNumber(limits.torqueNm*i/4),11,C.muted);}
  for(let i=0;i<=4;i++){const rpm=rpmMax*i/4,xx=x(rpm);line(s,xx,top,xx,bottom,C.grid,{dash:'2 6'});text(s,xx,bottom+21,displayNumber(rpm),11,C.muted,{anchor:'middle'});}text(s,width/2,bottom+43,'Turtal (o/min)',12,C.muted,{anchor:'middle'});
  model.curves.forEach((series,index)=>{
    const style=curveStyle(series);
    for(const segment of curveSegments(series.points)){s.items.push({type:'path',points:segment.map(p=>({x:x(p.rpm),y:y(p.value,series.metric)})),stroke:style.color,dash:style.dash,width:2.5});for(const p of segment)s.items.push({type:'circle',cx:x(p.rpm),cy:y(p.value,series.metric),r:2.4,fill:style.color});}
    const col=index%2,row=Math.floor(index/2),lx=left+col*(w/2),ly=bottom+66+row*21;line(s,lx,ly-4,lx+23,ly-4,style.color,{dash:style.dash,width:2.5});text(s,lx+30,ly,`${series.ownership==='stage'?model.stage:'Original'} · ${series.unit}`,mobile?10:12,C.muted);
  });return s;
}
function appendScene(target,source,x,y){target.items.push(...source.items.map(item=>({...item,translate:[x,y]})));}
export function exportScene(model,width=1400){
  if(model.presentation==='customer-summary')return customerSummaryScene(model,width);
  const s=scene(width,0);rect(s,0,0,width,1,C.bg);let y=44;
  text(s,48,y,'TUNINGSERVICE VEST',21,C.gold,{weight:600});text(s,width-48,y,'EFFEKTOPPSLAG',12,C.muted,{anchor:'end'});y+=43;
  const headerWidth=width-230;
  for(const t of wrapText(model.title,Math.floor(headerWidth/13))){text(s,48,y,t,23,C.text,{weight:600});y+=34;}
  text(s,48,y+4,model.stage,17,C.gold);y+=36;
  if(model.brand){const logo=brandLogoPath(model.brand);if(logo)s.items.push({type:'brand-image',asset:'brand',href:logo,x:width-180,y:72,width:125,height:80});text(s,width-118,180,model.brand.name,14,C.muted,{anchor:'middle'});}
  if(model.simulated){text(s,48,y,'TESTDATA – simulerte tuningdata',16,'#ffcf8c',{weight:600});y+=30;}
  text(s,48,y,model.note,17,C.text);y+=28;
  if(model.curves.length){appendScene(s,curveScene(model,width-96),48,y);y+=390;}
  if(model.curves.length){text(s,48,y,GRAPH_NOTES.peaks,17,C.text);y+=18;}
  const bw=(width-120)/2;appendScene(s,barScene(model.metrics[0],model.stage,bw),48,y);appendScene(s,barScene(model.metrics[1],model.stage,bw),72+bw,y);y+=303;
  const notes=[model.detailNote,'Rettleiande effekt. Resultatet avheng av tilstand og oppsett.'].filter(Boolean);
  for(const note of notes)for(const t of wrapText(note,125)){text(s,48,y,t,14,C.muted);y+=22;}
  y+=18;
  const clean=t=>customerHardwareText(customerEngineName(t).replace(/(\d+(?:[.,]\d+)?)\s*PK\b/gi,'$1 HK'));
  for(const [title,items,fallback] of model.requirements){
    text(s,48,y,title,16,C.gold,{weight:600});y+=25;
    for(const value of items.length?items:[fallback])for(const t of wrapText(clean(value),125)){text(s,48,y,t,14,C.muted);y+=21;}
    y+=15;
  }
  line(s,48,y,width-48,y);y+=29;text(s,48,y,'Tuningservice Vest · '+model.stage,13,C.muted);
  text(s,48,y+25,'Rettleiande effekt. Avklar oppsett og krav med Bjørn.',13,C.muted);s.height=y+58;s.items[0].height=s.height;return s;
}
function customerSummaryScene(model,width){
 const s=scene(width,0);rect(s,0,0,width,1,C.bg);let y=48;
 text(s,48,y,'TUNINGSERVICE VEST',23,C.gold,{weight:600});y+=48;
 for(const t of wrapText(model.title,75)){text(s,48,y,t,25,C.text,{weight:600});y+=36;}
 text(s,48,y,model.stage,20,C.gold);y+=50;
 if(model.brand){const logo=brandLogoPath(model.brand);if(logo)s.items.push({type:'brand-image',asset:'brand',href:logo,x:width-180,y:32,width:125,height:70});}
 text(s,48,y,model.note,20,C.text);y+=32;
 for(const t of wrapText(model.basis,110)){text(s,48,y,t,16,C.muted);y+=25;}
 y+=20;
 for(const m of model.metrics){
  text(s,48,y,m.label,22,C.gold,{weight:600});y+=37;
  const original=m.original===null?'Ikkje oppgitt':displayNumber(m.original)+' '+m.unit;
  const tuned=m.tuned===null?'Ikkje oppgitt':'opp til ca. '+displayNumber(m.tuned)+' '+m.unit;
  text(s,48,y,'Original: '+original+'   →   '+model.stage+': '+tuned,25,C.text,{weight:600});y+=24;
  const w=width-96,limit=axisLimit([m.original,m.tuned]);watermark(s,48,y,w,65);
  if(m.original!==null)rect(s,48,y+9,w*m.original/limit,15,C.original);
  if(m.tuned!==null)rect(s,48,y+38,w*m.tuned/limit,15,C.tuning);
  y+=105;
 }
 for(const [title,items]of model.requirements){const cleaned=items.map(customerHardwareText).filter(t=>t&&!/^Individuelt tilpassa motorprogramvare/i.test(t));if(!cleaned.length)continue;text(s,48,y,title,18,C.gold);y+=28;for(const item of cleaned)for(const t of wrapText(item,115)){text(s,48,y,t,16,C.muted);y+=24;}y+=14;}
 text(s,48,y,'Avklar samla oppsett og krav med Bjørn.',16,C.muted);y+=38;
 s.height=y;s.items[0].height=y;return s;
}
export function sceneToSvg(scene,doc=document){
  const ns='http://www.w3.org/2000/svg',root=doc.createElementNS(ns,'svg');root.setAttribute('viewBox',`0 0 ${scene.width} ${scene.height}`);root.setAttribute('role','img');root.setAttribute('aria-label','Graf. Dei same tala er tilgjengelege i tekst og tabell nedanfor.');
  for(const item of scene.items){let tag=item.type==='path'?'path':item.type==='image'||item.type==='brand-image'?'image':item.type;const n=doc.createElementNS(ns,tag);const attrs={};
    if(tag==='text'){n.textContent=item.text;Object.assign(attrs,{x:item.x,y:item.y,fill:item.fill,'font-size':item.size,'font-weight':item.weight||400,'text-anchor':item.anchor||'start','font-family':'Poppins, sans-serif'});}
    else if(tag==='path')Object.assign(attrs,{d:item.points.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' '),fill:'none',stroke:item.stroke,'stroke-width':item.width||1});
    else if(tag==='image')Object.assign(attrs,{href:item.href,x:item.x,y:item.y,width:item.width,height:item.height,preserveAspectRatio:'xMidYMid meet'});
    else for(const k of ['x','y','x1','x2','y1','y2','cx','cy','r','width','height','fill','stroke','rx'])if(item[k]!==undefined)attrs[k]=item[k];
    if(tag==='line')attrs['stroke-width']=item.width||1;if(item.dash)attrs['stroke-dasharray']=item.dash;if(item.opacity!==undefined)attrs.opacity=item.opacity;if(item.translate)attrs.transform=`translate(${item.translate.join(' ')})`;
    for(const [key,value] of Object.entries(attrs))n.setAttribute(key,String(value));root.append(n);
  }return root;
}
export function paintScene(ctx,s,images={}){
  function fitted(image,item){const scale=Math.min(item.width/image.width,item.height/image.height);ctx.drawImage(image,item.x+(item.width-image.width*scale)/2,item.y+(item.height-image.height*scale)/2,image.width*scale,image.height*scale);}
  for(const p of s.items){ctx.save();if(p.translate)ctx.translate(...p.translate);ctx.globalAlpha=p.opacity??1;ctx.lineWidth=p.width&&['path','line'].includes(p.type)?p.width:1;ctx.setLineDash(p.dash?p.dash.split(' ').map(Number):[]);
    ctx.fillStyle=p.fill||C.text;ctx.strokeStyle=p.stroke||C.grid;
    if(p.type==='text'){ctx.font=`${p.weight||400} ${p.size}px Poppins, sans-serif`;ctx.textAlign=p.anchor==='middle'?'center':p.anchor==='end'?'right':'left';ctx.fillText(p.text,p.x,p.y);}
    else if(p.type==='rect'){ctx.fillRect(p.x,p.y,p.width,p.height);if(p.stroke)ctx.strokeRect(p.x,p.y,p.width,p.height);}
    else if(p.type==='line'){ctx.beginPath();ctx.moveTo(p.x1,p.y1);ctx.lineTo(p.x2,p.y2);ctx.stroke();}
    else if(p.type==='path'){ctx.beginPath();p.points.forEach((a,i)=>i?ctx.lineTo(a.x,a.y):ctx.moveTo(a.x,a.y));ctx.stroke();}
    else if(p.type==='circle'){ctx.beginPath();ctx.arc(p.cx,p.cy,p.r,0,Math.PI*2);ctx.fill();}
    else if(images[p.asset]){if(p.type==='brand-image'){ctx.fillStyle='#f4f3ee';ctx.fillRect(p.x-8,p.y-8,p.width+16,p.height+16);}fitted(images[p.asset],p);}
    ctx.restore();
  }
}
