// Workerd does not implement redirect:'error'. Keep the same no-redirect
// guarantee explicitly, without forwarding provider credentials to a new URL.
export function cloudFetchWith(fetchImpl=fetch){
 return async(input,options={})=>{
  const rejectRedirect=options.redirect==='error';
  const response=await fetchImpl(input,rejectRedirect?{...options,redirect:'manual'}:options);
  if(rejectRedirect&&response.status>=300&&response.status<400)throw new TypeError('Provider redirect rejected');
  return response;
 };
}
export const cloudFetch=cloudFetchWith();
