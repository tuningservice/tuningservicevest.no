// Shared contact validation and retry state. No browser storage or personal-data logging.
export function parseOfferContact(value) {
  if (typeof value !== 'string' || value.length > 254 || /[\u0000-\u001f\u007f]/.test(value)) return null;
  const contact = value.trim();
  if (contact.includes('@')) {
    const valid = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(contact)
      && !contact.startsWith('.') && !contact.split('@')[0].endsWith('.') && !contact.includes('..');
    return valid ? { kind: 'email', email: contact, phone: null } : null;
  }
  if (!/^[+0-9 ()-]+$/.test(contact)) return null;
  let phone = contact.replace(/[ ()-]/g, '');
  if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  if (/^[49][0-9]{7}$/.test(phone)) phone = '+47' + phone;
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) return null;
  if (phone.startsWith('+47') && !/^\+47[49][0-9]{7}$/.test(phone)) return null;
  return { kind: 'phone', email: null, phone };
}

export function createOfferSubmission({ send, onState = () => {}, uuid = () => crypto.randomUUID() }) {
  let pending = false, sent = false, key = null, lastPayload = null, revision = 0;
  function changed() { if (!pending) { sent = false; onState({ pending, sent, error: null }); } }
  function invalidate() { revision++; pending = false; sent = false; key = null; lastPayload = null; onState({ pending, sent, error: null }); }
  async function submit(payload) {
    if (pending || sent) return;
    const fingerprint = JSON.stringify(payload);
    if (fingerprint !== lastPayload) { key = uuid(); lastPayload = fingerprint; }
    const version = revision;
    pending = true; onState({ pending, sent: false, error: null });
    try {
      const result = await send({ ...payload, requestId: key });
      if (version !== revision) return;
      sent = true; pending = false; onState({ pending, sent, result, error: null });
      return result;
    } catch (error) {
      if (version !== revision) return;
      pending = false; onState({ pending, sent: false, error: error?.code || 'delivery-failed' });
    }
  }
  return { submit, changed, invalidate, snapshot: () => ({ pending, sent }) };
}
