// Access redirects must not masquerade as an AI/provider error or lose input.
export function assertAssistantResponse(response){
 if(response.type==='opaqueredirect'||response.redirected){
  throw Object.assign(new Error('private-login-expired'),{code:'private-login-expired',data:{answer:'Innlogginga til den private testen har gått ut. Opne testsida på nytt og logg inn. Meldinga di er bevart.'}});
 }
}
