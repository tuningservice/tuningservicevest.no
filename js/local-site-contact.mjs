// Mounted ONLY in /test/home/. No change to the production contact form contract.
export function mountLocalSiteContact({api,sync}){
  if(document.body.dataset.localHomePreview!=='true')return;
  const form=document.getElementById('kontaktskjema'),status=document.getElementById('kontaktskjema-status');
  if(!form||!status)return;
  form.querySelector('.cf-turnstile')?.remove();
  let busy=false,requestId=null;
  form.addEventListener('input',()=>{if(!busy)requestId=null;});
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;
    const button=form.querySelector('[type=submit]');status.hidden=false;
    if(!form.reportValidity()){status.textContent='Fyll ut namn og ei gyldig e-postadresse.';return;}
    busy=true;button.disabled=true;status.textContent='Sender …';
    try{
      const fields=Object.fromEntries(['name','email','phone','company','message'].map(k=>[k,form.elements.namedItem(k).value.trim()]));
      const state=await sync.flush();requestId??=crypto.randomUUID();
      const result=await api('/api/local-site-contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,conversationId:state.conversationId,requestId})});
      if(result.accepted!==true)throw new Error();status.textContent=result.message;button.textContent='Registrert';
    }catch{status.textContent='Førespurnaden kunne ikkje stadfestast. Innhaldet er bevart. Prøv igjen, eller ring oss.';button.disabled=false;}
    finally{busy=false;}
  });
}
