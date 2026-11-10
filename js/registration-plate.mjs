export function registrationLabel(value){
 const normalized=String(value??'').trim().toUpperCase().replace(/\s+/g,'');
 return /^[A-Z0-9]{2,7}$/.test(normalized)?normalized.replace(/^([A-Z]{2})(\d{2,5})$/,'$1 $2'):'';
}
// Shared visual language for the input and the confirmed/customer-provided
// registration. This formats a number only; it does not identify a vehicle.
export function createRegistrationPlate(value,{input=null}={}){
 const label=registrationLabel(value);if(!input&&!label)return null;
 const root=document.createElement(input?'div':'span');root.className='registration-plate'+(input?'':' registration-display');
 const country=document.createElement('span');country.className='registration-country';country.setAttribute('aria-hidden','true');
 const flag=document.createElement('span');flag.className='registration-flag';const letter=document.createElement('span');letter.textContent='N';country.append(flag,letter);root.append(country);
 if(input)root.append(input);else{root.setAttribute('role','img');root.setAttribute('aria-label','Registreringsnummer '+label);const number=document.createElement('span');number.className='registration-number';number.textContent=label;root.append(number);}
 return root;
}
