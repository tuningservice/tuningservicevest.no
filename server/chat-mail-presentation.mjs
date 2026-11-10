const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function shortMailText(value,max=700){const text=String(value??'').trim();return text.length>max?text.slice(0,max)+' … (heile teksten ligg i vedlegget)':text;}
export function mailVehicleFields(context){
 const t=context?.technical??{},r=t.registered??{},stage=t.stages?.find(s=>s.stage===t.selectedStage),services=context?.selectedServices??(context?.selectedService?[context.selectedService]:[]);
 const fields=[['Bil',t.vehicle],['Regnr',context?.registration],['Registrert',[r.fuel,r.powerHk!=null?r.powerHk+' HK':null,r.engineCc!=null?r.engineCc+' cm³':null,r.gearbox,r.firstRegistered?'Førstegongsregistrert '+r.firstRegistered:null].filter(Boolean).join(' · ')],['Motorkode',r.engineCode],['Valt steg',t.selectedStage],['Valde tilval',services.map(s=>s.label).join(', ')]];
 if(stage){const fmt=(v,u)=>v==null?'ikkje oppgitt':v+' '+u;fields.push(['Effekt',fmt(stage.original?.powerHk,'HK')+' → '+fmt(stage.tuned?.powerHk,'HK')],['Dreiemoment',fmt(stage.original?.torqueNm,'Nm')+' → '+fmt(stage.tuned?.torqueNm,'Nm')]);}
 else if(t.vehicle)fields.push(['Avklaring','Motorvariant, tuning og pris må avklarast.']);
 return fields;
}
export function presentCompactMail({title,to,subject,simulated,fields,message,notes=[],fullText,previewText=fullText,reference,createdAt,replyTo,production=false}){
 const rows=fields.filter(([,v])=>v!==null&&v!==undefined&&v!=='');
 const mode=production?'Frå tuningservicevest.no':simulated===false?'Lokal test · ekte e-postlevering':'Lokal test · ingen e-post er send';
 const time=Number.isFinite(Date.parse(createdAt))?new Intl.DateTimeFormat('nb-NO',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Oslo'}).format(new Date(createdAt)):'';
 const foot=[time,reference?'Referanse '+reference.slice(0,8):''].filter(Boolean).join(' · ');
 const attachmentNote='Heile samtalen og bilhistorikken ligg i samtale.txt. Tekniske referansar er samla der. Ingen meldingar er kutta.';
 const bodyMessage=shortMailText(message),text=[title,mode,...rows.map(([k,v])=>k+': '+v),bodyMessage?'\nFrå kunden:\n'+bodyMessage:'',...notes,'\n'+attachmentNote,foot].filter(Boolean).join('\n');
 const html='<!doctype html><html lang="nn"><meta charset="utf-8"><body style="margin:0;background:#f1f1ee;font:16px Arial,sans-serif;color:#202020"><div style="max-width:640px;margin:24px auto;background:#fff;border:1px solid #ddd"><header style="padding:24px;background:#161616;color:#e7c16b"><p style="margin:0 0 10px;font-size:13px">TUNINGSERVICE VEST</p><h1 style="font-size:24px;margin:0">'+esc(title)+'</h1><p style="color:#ddd;margin:12px 0 0;font-size:13px">'+esc(mode)+'</p></header><div style="padding:24px"><table style="width:100%;border-collapse:collapse">'+rows.map(([k,v])=>'<tr><th style="padding:8px 14px 8px 0;text-align:left;vertical-align:top;font-size:14px;color:#666">'+esc(k)+'</th><td style="padding:8px 0;line-height:1.5">'+esc(v)+'</td></tr>').join('')+'</table>'+(bodyMessage?'<h2 style="font-size:17px;margin-top:24px">Frå kunden</h2><p style="white-space:pre-wrap;line-height:1.6">'+esc(bodyMessage)+'</p>':'')+notes.map(n=>'<p style="line-height:1.6">'+esc(n)+'</p>').join('')+'<p style="padding-top:20px;border-top:1px solid #ddd;font-size:14px;line-height:1.5">'+esc(attachmentNote)+'</p><p style="font-size:12px;color:#666">'+esc(foot)+'</p></div></div></body></html>';
 return {to,...(production?{production:true}:{}),...(replyTo?{replyTo}:{}),subject:production?subject.replace(/^\[LOKAL TEST\] /,''):subject,text,html,previewText,attachments:[{filename:'samtale.txt',contentType:'text/plain; charset=utf-8',contentBase64:Buffer.from(fullText).toString('base64')}]};
}
