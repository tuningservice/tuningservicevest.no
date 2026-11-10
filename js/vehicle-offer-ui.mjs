import { parseOfferContact, createOfferSubmission } from './vehicle-offer-state.mjs';
const el=id=>document.getElementById(id);
export function createVehicleOfferUi({ send }) {
  let context=null, fingerprint=null, opener=null;
  const disabled=new Map();
  const errors={
    'invalid-contact':'Oppgi eit gyldig mobilnummer eller ei e-postadresse.',
    'invalid-selection':'Bilvalet kunne ikkje kontrollerast. Vel bilen på nytt. Skjemainnhaldet er teke vare på.',
    'invalid-stage':'Tuningsteget har endra seg. Vel steget på nytt. Skjemainnhaldet er teke vare på.',
    'lookup-expired':'Biloppslaget har gått ut. Søk opp bilen på nytt. Kontaktopplysningane er tekne vare på.',
    'vehicle-context-changed':'Registreringsnummeret er endra. Søk opp bilen på nytt.',
    quota:'For mange forsøk. Vent litt og prøv igjen. Innhaldet er teke vare på.',
    'request-changed':'Førespurnaden er endra. Endre eit skjemafelt og prøv igjen.',
    'delivery-failed':'Testleveringa feila. Ingen e-post er send. Prøv igjen – innhaldet er teke vare på.',
    timeout:'Vi fekk ikkje stadfesta testleveringa. Prøv igjen med same innhald; ei registrert førespurnad blir ikkje duplisert.',
  };
  function show(text,error=false){el('offer-status').textContent=text;el('offer-status').dataset.error=String(error);}
  function freeze(pending) {
    if(pending && !disabled.size) {
      for(const target of document.querySelectorAll('#lookup-form input,#lookup-form button,#manual-button,#change-button,.select-grid select,#confirm-button,#retry-button,#stage-tabs button,#demo-button,#demo-scenario,#simulate-offer-failure,#offer-button,#offer-close,#unresolved-offer-button,#offer-form input,#offer-form textarea,#offer-form button')) {
        disabled.set(target,target.disabled);target.disabled=true;
      }
    } else if(!pending && disabled.size) { for(const [target,wasDisabled] of disabled) target.disabled=wasDisabled;disabled.clear(); }
  }
  const submission=createOfferSubmission({send,onState(state){
    freeze(state.pending);
    el('offer-form').setAttribute('aria-busy',String(state.pending));
    el('offer-submit').disabled=state.pending||state.sent;
    el('offer-submit').textContent=state.pending?'Registrerer testførespurnad …':state.sent?'Testførespurnad registrert':'Registrer testførespurnad';
    if(state.pending)show('Registrerer lokalt. Ingen e-post blir send.');
    else if(state.sent)show('Testførespurnad registrert – ingen e-post er send');
    else if(state.error)show(errors[state.error]||errors['delivery-failed'],true);
    else show('');
  }});
  function open(button){
    if(!context || context.busy)return;
    opener=button;el('offer-panel').hidden=false;el('offer-contact').focus();
  }
  el('offer-button').addEventListener('click',()=>open(el('offer-button')));
  el('unresolved-offer-button').addEventListener('click',()=>open(el('unresolved-offer-button')));
  function close(){if(submission.snapshot().pending)return;el('offer-panel').hidden=true;opener?.focus();}
  el('offer-close').addEventListener('click',close);
  el('offer-panel').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}});
  el('offer-form').addEventListener('input',()=>{el('offer-contact').removeAttribute('aria-invalid');submission.changed();});
  el('offer-form').addEventListener('submit',event=>{
    event.preventDefault();if(!context || context.busy || submission.snapshot().pending || submission.snapshot().sent)return;
    const contact=el('offer-contact').value;
    if(!parseOfferContact(contact)){show(errors['invalid-contact'],true);el('offer-contact').setAttribute('aria-invalid','true');el('offer-contact').focus();return;}
    const {lookupToken,registration,selection,confirmed,stage}=context;
    submission.submit({contact,name:el('offer-name').value,message:el('offer-message').value,website:el('offer-website').value,
      lookupToken,registration,selection,confirmed,stage});
  });
  return {setContext(next){
    const signature=JSON.stringify({lookupToken:next.lookupToken,registration:next.registration,selection:next.selection,confirmed:next.confirmed,stage:next.stage});
    if(signature!==fingerprint){fingerprint=signature;submission.invalidate();}
    context=next;
    el('offer-context').textContent=next.label;
    el('offer-variant-status').textContent=next.confirmed?'Du har stadfesta bilvalet. Bjørn vurderer tilbodet individuelt.':'Bilvarianten er uavklart. Bjørn må avklare rett variant og aktuelle tuningalternativ.';
    el('unresolved-offer-wrap').hidden=next.confirmed||!next.eligible||next.busy;
    el('offer-button').disabled=next.busy;
    if(!next.eligible&&!next.confirmed)el('offer-panel').hidden=true;
  }};
}

