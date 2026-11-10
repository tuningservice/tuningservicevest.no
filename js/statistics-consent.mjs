const key='tsv-statistics-choice',measurement='G-MRJGSB2C4N';
let panel=null,loaded=false;
function choice(){try{return localStorage.getItem(key);}catch{return null;}}
function activate(){
 if(loaded)return;loaded=true;window.dataLayer=window.dataLayer||[];
 window.gtag=function(){window.dataLayer.push(arguments);};
 window.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 window.gtag('js',new Date());window.gtag('config',measurement);
 const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+measurement;document.head.append(script);
}
function save(value){
 try{localStorage.setItem(key,value);}catch{}
 if(value==='yes'){window['ga-disable-'+measurement]=false;if(loaded&&typeof window.gtag==='function')window.gtag('consent','update',{analytics_storage:'granted'});else activate();}
 else{
  window['ga-disable-'+measurement]=true;
  if(typeof window.gtag==='function')window.gtag('consent','update',{analytics_storage:'denied'});
  for(const cookie of document.cookie.split(';')){const name=cookie.split('=')[0].trim();if(/^_ga(?:_|$)/.test(name))for(const domain of ['',location.hostname,'.'+location.hostname])document.cookie=name+'=; Max-Age=0; Path=/'+(domain?'; Domain='+domain:'');}
 }
 panel?.remove();panel=null;
}
function show(){
 if(panel)return;
 panel=document.createElement('aside');panel.className='statistics-choice';panel.setAttribute('aria-label','Valfri statistikk');
 const p=document.createElement('p');p.textContent='Vi bruker nødvendige tryggleiksfunksjonar. Vil du også tillate besøksstatistikk?';
 const yes=document.createElement('button'),no=document.createElement('button');
 yes.textContent='Godta statistikk';no.textContent='Berre nødvendig';yes.type=no.type='button';yes.onclick=()=>save('yes');no.onclick=()=>save('no');
 const base=document.querySelector('meta[name="assistant-api-base"]')?.content?.replace(/\/api\/assistant$/,'')??'';
 const link=document.createElement('a');link.href=base+'/personvern/';link.textContent='Personvern';panel.append(p,no,yes,link);document.body.append(panel);
}
if(choice()==='yes')activate();
if(!choice())show();
document.querySelectorAll('[data-statistics-settings]').forEach(button=>button.addEventListener('click',show));
