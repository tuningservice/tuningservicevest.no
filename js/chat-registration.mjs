// Deterministic intent recognition only. A valid-looking number is not proof
// of vehicle identity; the existing server lookup/matching must still run.
export function registrationMessageIntent(message){
 if(typeof message!=='string'||message.length>2000)return {kind:'none'};
 const text=message.trim(),cue=/\b(?:sjekk|finn|slå\s+opp|sla\s+opp|søk(?:\s+opp)?|sjå\s+på|se\s+på|regnr|registreringsnummer(?:et)?|bilen\s+min\s+(?:er|har))(?=$|[\s:,.!?])/i.test(text);
 const explicitRegistration=/\b(?:regnr|registreringsnummer(?:et)?)(?=$|[\s:,.!?])/i.test(text);
 if(/\b(?:ikkje|ikke|aldri)\b.{0,35}\b(?:slå|sla|sjekk|søk|finn|oppslag)(?=$|[\s.,!?])|\bvent\s+med\b|\butan\s+(?:å\s+)?(?:slå|søk|oppslag)/i.test(text))return {kind:'none'};
 const clean=text.replace(/https?:\/\/\S+|[^\s@]+@[^\s@]+/gi,' '),numbers=[];
 for(const m of clean.matchAll(/(?<![\p{L}\p{N}_@/])([a-z]{2})[ \t\u00a0]*([0-9]{2,5})(?![\p{L}\p{N}_@])/giu)){
   if(['HK','HP','KW','NM','CC','CM'].includes(m[1].toUpperCase())||m[2].length<4&&!explicitRegistration)continue;
   const number=m[1].toUpperCase()+m[2];if(!numbers.includes(number))numbers.push(number);
 }
 if(!numbers.length)return {kind:'none'};
 const uncertain=/\b(?:kanskje|trur|tror|usikker|enten|eller)\b/i.test(text);
 const bare=/^[a-z]{2}[ \t\u00a0]*[0-9]{4,5}[.!?]?$/i.test(text);
 if(numbers.length===1&&!uncertain&&(bare||cue))return {kind:'lookup',registration:numbers[0],answer:'Eg sjekkar registreringsnummeret …'};
 return {kind:'clarify',registrations:numbers,answer:numbers.length>1?'Du nemnde fleire registreringsnummer. Kva nummer vil du slå opp?':'Vil du at eg skal slå opp dette oppsettet?'};
}
