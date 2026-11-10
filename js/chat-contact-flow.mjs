import {createContactAttempt} from './chat-contact-attempt.mjs';
import {contactPresentation} from './chat-contact-presentation.mjs';
import {combineContactMessage} from './contact-entry.mjs';
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const errors={'invalid-contact':'Skriv ei gyldig e-postadresse eller eit gyldig mobilnummer.','conversation-busy':'Vent til AI-svaret er ferdig, og prøv igjen.','conversation-changed':'Samtalen er oppdatert. Sjå over innhaldet og prøv igjen.','conversation-too-large':'Samtalen er for stor for samtalen. Ingenting er kutta eller sendt.','mail-delivery-uncertain':'Leveringa er ikkje stadfesta. Vi prøver ikkje automatisk på nytt, for å unngå dobbel e-post. Kontaktfeltet og samtalen er bevarte. Ring Bjørn ved behov.','mail-too-large':'Samtalen er for stor for e-postleveringa. Ingenting er kutta. Ring Bjørn for vidare oppfølging.','mail-not-configured':'E-postlevering er ikkje konfigurert i samtalen. Innhaldet er bevart.','mail-access-denied':'E-posttenesta avviste tilgangen. Innhaldet er bevart.','mail-provider-rejected':'E-posttenesta avviste førespurnaden. Innhaldet er bevart.','mail-quota':'E-posttenesta ber oss vente. Innhaldet er bevart; prøv igjen seinare.','mail-daily-limit':'Den daglege grensa for e-post er nådd. Innhaldet er bevart.','delivery-failed':'Leveringa feila. Kontaktfeltet og samtalen er bevarte. Prøv igjen.','quota':'For mange forsøk. Vent litt og prøv igjen.'};
export function createChatContactFlow({api,sync,mount,beforeSend=()=>{},onRegistered=()=>{}}){
  let card=null,anchor=null,preview=null,busy=false,accepted=false,dirtyAfterSend=false;const attempt=createContactAttempt();
  function renderOverview(data){
    if(!data||!Array.isArray(data.conversations))throw {code:'preview-unavailable'};
    const presentation=contactPresentation(data);card.heading.textContent=presentation.title;card.root.setAttribute('aria-label',presentation.title);card.explanation.textContent=presentation.explanation;card.messageLabel.textContent=presentation.messageLabel;card.extrasTitle.textContent=presentation.extrasTitle;
    if(presentation.hasVehicle)card.extras.append(card.messageBlock);else card.form.insertBefore(card.messageBlock,card.extras);
    card.target.hidden=!presentation.hasVehicle;
    card.privacy.textContent=(presentation.hasVehicle?'Vi legg ved valet og samtalen for å følgje opp førespurnaden.':'Vi brukar kontaktopplysninga, eventuell melding og samtalen til å følgje opp førespurnaden.')+(preview?.simulated===false?'':' E-postutsending er mellombels slått av.')+' App-loggen blir sletta etter 30 dagar. Sjå personvern for e-postkopiar og rettane dine.';
    const root=card.preview;root.replaceChildren();const info=make('dl',null,'contact-overview-fields');
    for(const [label,value]of [...(presentation.hasVehicle?[['Modell',data.vehicle],['Val',[data.stage,...data.services].filter(Boolean).join(' · ')||'Variant/arbeid må avklarast']]:[]),['Kontakt',card.input.value.trim()||'E-post eller mobilnummer frå feltet over']])info.append(make('dt',label),make('dd',value));
    root.append(info,make('p',(data.hasQuestion?'Seinaste meldinga di: ':'Førespurnad: ')+data.purpose));
    if(card.message.value.trim())root.append(make('p','Tilleggsmelding: '+card.message.value.trim()));
    if(data.otherActiveVehicle)root.append(make('p','Denne førespurnaden gjeld modellen ovanfor. Valet som er aktivt no, er '+data.otherActiveVehicle+'.','notice'));
    const facts=make('details'),factsTitle=make('summary','Sjå tekniske opplysningar');facts.append(factsTitle);
    if(data.registration)facts.append(make('p','Registreringsnummer: '+data.registration));
    if(data.vehicleFacts.length)facts.append(make('p',data.vehicleFacts.join(' · ')));
    if(data.performance){const {original,tuned}=data.performance,number=(v,u)=>v==null?'Ikkje oppgitt':v+' '+u;
      facts.append(make('p','Effekt: '+number(original?.powerHk,'HK')+' → '+(tuned?.powerHk==null?'Ikkje oppgitt':'opp til ca. '+number(tuned.powerHk,'HK'))),make('p','Dreiemoment: '+number(original?.torqueNm,'Nm')+' → '+(tuned?.torqueNm==null?'Ikkje oppgitt':'opp til ca. '+number(tuned.torqueNm,'Nm'))));}
    if(presentation.hasVehicle||data.registration)root.append(facts);const transcript=make('details');transcript.append(make('summary','Les samtalen ('+data.messageCount+' meldingar)'));
    for(const group of data.conversations){if(data.conversations.length>1)transcript.append(make('h3',group.vehicle+(group.forThisRequest?' – denne førespurnaden':'')));const list=make('ol',null,'customer-transcript');for(const message of group.messages){const item=make('li');item.append(make('strong',message.speaker),make('p',message.text));list.append(item);}transcript.append(list);}if(data.messageCount)root.append(transcript);root.append(make('p',presentation.attachmentNote,'help'));
    card.overview=data;
  }
  async function refresh(){
    const state=await sync.flush();
    preview=await api('/api/chat-contact-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:state.conversationId,anchorEventId:anchor})});
    card.target.textContent='Førespurnaden gjeld: '+preview.vehicleText;
    renderOverview(preview.overview);
    return preview;
  }
  function build(){
    const root=make('section',null,'chat-contact-card');root.setAttribute('aria-label','Få svar frå Bjørn');
    const heading=make('h2','Få svar frå Bjørn'),explanation=make('p','Du kan kontakte oss utan å gjere eit val. Vi legg ved samtalen dersom du har skrive med assistenten.');root.append(heading,explanation);
    const target=make('p',null,'contact-target'),form=make('form'),label=make('label','E-post eller mobilnummer'),input=make('input');
    input.id='chat-contact-value';input.name='contact';input.autocomplete='off';input.required=true;input.maxLength=254;label.htmlFor=input.id;
    const extras=make('details'),extrasTitle=make('summary','Namn og melding (valfritt)'),name=make('input'),message=make('textarea');
    name.id='chat-contact-name';name.maxLength=100;const nameLabel=make('label','Namn (valfritt)');nameLabel.htmlFor=name.id;
    message.id='chat-contact-message';message.rows=2;message.maxLength=3000;const messageLabel=make('label','Kva kan vi hjelpe deg med? (valfritt)');messageLabel.htmlFor=message.id;
    const messageBlock=make('div',null,'contact-message');messageBlock.append(messageLabel,message);extras.append(extrasTitle,nameLabel,name);
    const details=make('details'),title=make('summary','Sjå kva som blir sendt'),content=make('div',null,'customer-contact-overview');details.append(title,content);details.addEventListener('toggle',()=>{if(details.open){content.textContent='Hentar oversikta …';refresh().catch(()=>{content.textContent='Oversikta kunne ikkje hentast. Prøv igjen før du sender.';});}});
    const send=make('button','Send til Bjørn'),status=make('p',null,'status'),privacy=make('p','Vi legg ved valet og samtalen for å følgje opp førespurnaden. App-loggen blir sletta etter 30 dagar. Sjå personvern.','help');
    send.type='submit';status.setAttribute('role','status');status.setAttribute('aria-live','polite');input.setAttribute('aria-describedby','chat-contact-status');status.id='chat-contact-status';
    form.noValidate=true;form.append(label,input,messageBlock,extras,details,send,status,privacy);root.append(target,form);
    const trap=make('input');trap.name='website';trap.tabIndex=-1;trap.autocomplete='off';trap.setAttribute('aria-hidden','true');trap.className='contact-honeypot';form.append(trap);
    function changed(){if(busy)return;accepted=false;send.disabled=false;send.textContent='Send til Bjørn';status.textContent='';attempt.reset();if(card?.overview&&details.open)renderOverview(card.overview);}
    for(const field of [input,name,message])field.addEventListener('input',changed);
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(busy||accepted)return;busy=true;send.disabled=true;send.textContent='Sender …';status.textContent='Sender …';input.removeAttribute('aria-invalid');for(const field of [input,name,message])field.disabled=true;
      try{
        await beforeSend();
        const p=await refresh(),state=sync.state();
        const body=attempt.prepare({conversationId:state.conversationId,revision:p.revision,anchorEventId:anchor,contact:input.value,name:name.value,message:message.value,website:trap.value});
        const result=await api('/api/chat-contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        if(result.accepted!==true||typeof result.simulated!=='boolean')throw {code:'delivery-failed'};
        accepted=true;status.textContent=result.message;send.textContent='Registrert';onRegistered(result);
      }catch(error){
        status.textContent=errors[error.code]||'Førespurnaden kunne ikkje registrerast. Innhaldet er bevart. Prøv igjen.';
        if(error.code==='conversation-changed')attempt.reset();
        if(error.code==='invalid-contact')input.setAttribute('aria-invalid','true');
        send.textContent='Send til Bjørn';
      }finally{busy=false;if(dirtyAfterSend){dirtyAfterSend=false;accepted=false;attempt.reset();send.textContent='Send til Bjørn';}send.disabled=accepted;for(const field of [input,name,message])field.disabled=false;if(input.getAttribute('aria-invalid')==='true')input.focus();}
    });
    return {root,heading,explanation,extras,extrasTitle,messageBlock,messageLabel,target,form,input,name,message,preview:content,status,send,details,privacy};
  }
  async function open(anchorEventId=null,{initialMessage=''}={}){
    if(!card)card=build();
    if(anchor!==anchorEventId){accepted=false;attempt.reset();card.send.disabled=false;card.send.textContent='Send til Bjørn';card.status.textContent='';}
    const combined=combineContactMessage(card.message.value,initialMessage);if(combined.value!==card.message.value){accepted=false;attempt.reset();card.send.disabled=false;card.send.textContent='Send til Bjørn';card.status.textContent='';}card.message.value=combined.value;
    if(initialMessage){card.extras.open=true;if(combined.tooLong)card.status.textContent='Meldinga di er bevart. Legg til emnet sjølv dersom det skal endrast; feltet har plass til 3000 teikn.';}
    anchor=anchorEventId;mount(card.root,anchor);card.input.focus({preventScroll:true});const scroller=card.root.closest('#chat-messages');if(scroller)scroller.scrollTop=card.root.closest('li').offsetTop-scroller.offsetTop;else card.root.scrollIntoView({behavior:'instant',block:'start'});
    try{await refresh();}catch(e){card.status.textContent=errors[e.code]||'Samtalen er ikkje ferdig lagra. Prøv igjen før du sender.';}
  }
  function dirty(){if(!card)return;if(busy){dirtyAfterSend=true;return;}accepted=false;attempt.reset();card.send.disabled=false;card.send.textContent='Send til Bjørn';card.status.textContent='';card.details.open=false;card.preview.textContent='Oversikta blir oppdatert når du opnar henne.';card.target.textContent='Valet eller samtalen er oppdatert. Innhaldet blir kontrollert på nytt før sending.';}
  return {open,dirty};
}
