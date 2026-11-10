// Shared primitives. No database is opened by importing server-only helpers.
import {createHash} from 'node:crypto';
export class JournalError extends Error{constructor(code,status=400){super(code);this.code=code;this.status=status;}}
export const validUuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
export const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
