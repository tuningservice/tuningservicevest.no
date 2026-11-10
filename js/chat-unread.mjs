// Session-only state. One real message revision gives at most one notification.
export function createChatUnread(onChange=()=>{}){
  let open=false;const delivered=new Set(),unread=new Set();
  const emit=()=>onChange(unread.size);
  return {receive(id){if(!id||delivered.has(id))return;delivered.add(id);if(!open)unread.add(id);emit();},show(){open=true;unread.clear();emit();},hide(){open=false;},count:()=>unread.size};
}
