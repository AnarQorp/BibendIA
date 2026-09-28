import net from 'node:net';
import tls from 'node:tls';
import type pg from 'pg';
import type { PiiProtection } from '../../security/pii-protection.js';
import { inTenantTransaction } from '../../persistence/pool.js';
import type { ClaimedOutboxEvent,EffectResult,OutboxEffectAdapter } from '../../worker/outbox.js';

export type SmtpMessage={from:string;to:string;replyTo?:string;subject:string;text:string;html:string};
export type SmtpSendResult={receiptRef:string};
export class SmtpDeliveryError extends Error {constructor(readonly classification:'transient'|'permanent'|'unknown',readonly safeCode:string){super(safeCode);}}
export interface SmtpTransport {send(message:SmtpMessage,idempotencyKey:string,signal:AbortSignal):Promise<SmtpSendResult>}
export interface SecretResolver {resolve(reference:string):Promise<string>}
export type SmtpConfig={host:string;port:number;tlsMode:'tls'|'starttls'|'plain';user:string;passwordRef:string;sender:string;destination:string;timeoutMs:number};

export class PublicLeadNotificationAdapter implements OutboxEffectAdapter {
  constructor(private pool:pg.Pool,private pii:PiiProtection,private transport:SmtpTransport,private sender:string,private destination:string){}
  async execute(event:ClaimedOutboxEvent,idempotencyKey:string,signal:AbortSignal):Promise<EffectResult>{
    if(event.event_type!=='public_lead.notification_requested')return {outcome:'permanent_failure',code:'UNSUPPORTED_OUTBOX_EVENT'};
    const leadId=String(event.payload_jsonb.leadId??'');
    try{
      const row=await inTenantTransaction(this.pool,event.tenant_id,async c=>(await c.query(`SELECT * FROM public_leads WHERE tenant_id=$1 AND id=$2`,[event.tenant_id,leadId])).rows[0],'bibendia_worker');
      if(!row)return {outcome:'permanent_failure',code:'PUBLIC_LEAD_NOT_FOUND'};
      const reveal=(field:string,prefix:string)=>this.pii.reveal(row.id,field,{ciphertext:row[`${prefix}_ciphertext`],nonce:row[`${prefix}_nonce`],auth_tag:row[`${prefix}_auth_tag`],key_id:row[`${prefix}_key_id`]});
      const workshop=reveal('public_lead.workshop','workshop'),contact=reveal('public_lead.contact_name','contact_name'),phone=reveal('public_lead.phone','phone');
      const email=row.email_ciphertext?reveal('public_lead.email','email'):undefined,message=row.message_ciphertext?reveal('public_lead.message','message'):undefined;
      const text=[`Nuevo contacto web de ${workshop}`,`Contacto: ${contact}`,`Teléfono: ${phone}`,email?`Email: ${email}`:null,message?`Mensaje: ${message}`:null,`Lead: ${row.id}`].filter(Boolean).join('\n');
      const html=`<h1>Nuevo contacto web</h1><dl><dt>Taller</dt><dd>${escapeHtml(workshop)}</dd><dt>Contacto</dt><dd>${escapeHtml(contact)}</dd><dt>Teléfono</dt><dd>${escapeHtml(phone)}</dd>${email?`<dt>Email</dt><dd>${escapeHtml(email)}</dd>`:''}${message?`<dt>Mensaje</dt><dd>${escapeHtml(message)}</dd>`:''}</dl><p>Lead: ${escapeHtml(row.id)}</p>`;
      const sent=await this.transport.send({from:this.sender,to:this.destination,replyTo:email,subject:'Nuevo contacto web BibendIA',text,html},idempotencyKey,signal);
      return {outcome:'succeeded',receiptRef:sent.receiptRef,evidence:{provider:'smtp',status:'accepted'}};
    }catch(error){if(error instanceof SmtpDeliveryError)return error.classification==='transient'?{outcome:'failed_safe_to_retry',code:error.safeCode}:error.classification==='permanent'?{outcome:'permanent_failure',code:error.safeCode}:{outcome:'unknown_outcome',code:error.safeCode};return {outcome:'unknown_outcome',code:'SMTP_UNCLASSIFIED_FAILURE'};}
  }
}

export class NodeSmtpTransport implements SmtpTransport {
  constructor(private config:SmtpConfig,private secrets:SecretResolver){}
  async send(message:SmtpMessage,idempotencyKey:string,signal:AbortSignal):Promise<SmtpSendResult>{
    validateMailbox(message.from);validateMailbox(message.to);if(message.replyTo)validateMailbox(message.replyTo);
    if(message.from!==this.config.sender||message.to!==this.config.destination)throw new SmtpDeliveryError('permanent','SMTP_ENVELOPE_NOT_ALLOWED');
    const password=await this.secrets.resolve(this.config.passwordRef);let socket:net.Socket|tls.TLSSocket=await connect(this.config,signal);const io=new SmtpIo(socket,this.config.timeoutMs,signal);
    try{await io.expect([220]);await io.command(`EHLO bibendia.local`,[250]);if(this.config.tlsMode==='starttls'){await io.command('STARTTLS',[220]);socket=tls.connect({socket,servername:this.config.host});await onceSecure(socket,this.config.timeoutMs,signal);io.replace(socket);await io.command('EHLO bibendia.local',[250]);}await io.command('AUTH LOGIN',[334]);await io.command(Buffer.from(this.config.user).toString('base64'),[334]);await io.command(Buffer.from(password).toString('base64'),[235]);await io.command(`MAIL FROM:<${message.from}>`,[250]);await io.command(`RCPT TO:<${message.to}>`,[250,251]);await io.command('DATA',[354]);const boundary=`bibendia-${idempotencyKey.replace(/[^A-Za-z0-9]/g,'').slice(0,40)}`;const headers=[`From: ${message.from}`,`To: ${message.to}`,message.replyTo?`Reply-To: ${message.replyTo}`:null,`Subject: ${sanitizeHeader(message.subject)}`,'MIME-Version: 1.0',`Content-Type: multipart/alternative; boundary="${boundary}"`,`X-BibendIA-Idempotency-Key: ${sanitizeHeader(idempotencyKey)}`].filter(Boolean).join('\r\n');const body=`${headers}\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${dotSafe(message.text)}\r\n--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${dotSafe(message.html)}\r\n--${boundary}--\r\n.`;await io.command(body,[250]);await io.command('QUIT',[221]);return {receiptRef:`smtp:${idempotencyKey}`};}finally{socket.destroy();}
  }
}
class SmtpIo{private buffer='';constructor(private socket:net.Socket|tls.TLSSocket,private timeout:number,private signal:AbortSignal){}replace(s:net.Socket|tls.TLSSocket){this.socket=s;this.buffer='';}async command(line:string,codes:number[]){this.socket.write(`${line}\r\n`);return this.expect(codes);}async expect(codes:number[]){const line=await readResponse(this.socket,this.timeout,this.signal);const code=Number(line.slice(0,3));if(!codes.includes(code))throw new SmtpDeliveryError(code>=400&&code<500?'transient':code>=500?'permanent':'unknown',code>=500?'SMTP_REJECTED':'SMTP_TEMPORARY_FAILURE');return line;}}
async function connect(c:SmtpConfig,signal:AbortSignal){return new Promise<net.Socket|tls.TLSSocket>((resolve,reject)=>{const s=c.tlsMode==='tls'?tls.connect({host:c.host,port:c.port,servername:c.host}):net.connect({host:c.host,port:c.port});const timer=setTimeout(()=>{s.destroy();reject(new SmtpDeliveryError('transient','SMTP_TIMEOUT'));},c.timeoutMs);const abort=()=>{s.destroy();reject(new SmtpDeliveryError('unknown','SMTP_ABORTED'));};signal.addEventListener('abort',abort,{once:true});s.once(c.tlsMode==='tls'?'secureConnect':'connect',()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);resolve(s);});s.once('error',()=>{clearTimeout(timer);reject(new SmtpDeliveryError('transient','SMTP_CONNECTION_FAILED'));});});}
async function onceSecure(s:net.Socket|tls.TLSSocket,timeout:number,signal:AbortSignal){const secureSocket=s as tls.TLSSocket;return new Promise<void>((resolve,reject)=>{const t=setTimeout(()=>reject(new SmtpDeliveryError('transient','SMTP_TIMEOUT')),timeout);const abort=()=>reject(new SmtpDeliveryError('unknown','SMTP_ABORTED'));signal.addEventListener('abort',abort,{once:true});secureSocket.once('secureConnect',()=>{clearTimeout(t);signal.removeEventListener('abort',abort);resolve();});secureSocket.once('error',()=>reject(new SmtpDeliveryError('transient','SMTP_TLS_FAILED')));});}
async function readResponse(s:net.Socket|tls.TLSSocket,timeout:number,signal:AbortSignal){return new Promise<string>((resolve,reject)=>{let data='';const done=()=>{const lines=data.split('\r\n').filter(Boolean);const last=lines.at(-1);if(last&&/^\d{3} /.test(last)){cleanup();resolve(last);}};const onData=(b:Buffer)=>{data+=b.toString('utf8');done();};const onError=()=>{cleanup();reject(new SmtpDeliveryError('unknown','SMTP_CONNECTION_INTERRUPTED'));};const onAbort=()=>{cleanup();reject(new SmtpDeliveryError('unknown','SMTP_ABORTED'));};const timer=setTimeout(()=>{cleanup();reject(new SmtpDeliveryError('transient','SMTP_TIMEOUT'));},timeout);const cleanup=()=>{clearTimeout(timer);s.off('data',onData);s.off('error',onError);signal.removeEventListener('abort',onAbort);};s.on('data',onData);s.once('error',onError);signal.addEventListener('abort',onAbort,{once:true});});}
function validateMailbox(v:string){if(!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+$/.test(v))throw new SmtpDeliveryError('permanent','SMTP_ADDRESS_INVALID');}
function sanitizeHeader(v:string){return v.replace(/[\r\n]/g,' ').slice(0,200);}
function dotSafe(v:string){return v.replace(/\r?\n/g,'\r\n').replace(/^\./gm,'..');}
export function escapeHtml(v:string){return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
