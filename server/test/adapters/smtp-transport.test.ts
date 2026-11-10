import net from 'node:net';
import { describe,expect,it } from 'vitest';
import { NodeSmtpTransport } from '../../src/adapters/smtp/public-lead-smtp.js';

describe('SMTP actual local test server',()=>{
 async function smtp(dropAfterData=false){
  let data='',inData=false;
  const server=net.createServer(socket=>{socket.write('220 local test SMTP\r\n');let buffer='';socket.on('data',chunk=>{
   buffer+=chunk.toString();let index:number;
   while((index=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+2);
    if(inData){if(line==='.') {inData=false;if(dropAfterData)socket.destroy();else socket.write('250 accepted\r\n');}else data+=line+'\n';}
    else if(line.startsWith('EHLO'))socket.write('250 local\r\n');else if(line==='AUTH LOGIN')socket.write('334 user\r\n');else if(line===Buffer.from('test').toString('base64'))socket.write('334 password\r\n');else if(line===Buffer.from('secret').toString('base64'))socket.write('235 authenticated\r\n');else if(line.startsWith('MAIL')||line.startsWith('RCPT'))socket.write('250 ok\r\n');else if(line==='DATA'){inData=true;socket.write('354 go\r\n');}else if(line==='QUIT')socket.write('221 bye\r\n');
   }
  });});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  const transport=new NodeSmtpTransport({host:'127.0.0.1',port:(server.address() as net.AddressInfo).port,tlsMode:'plain',user:'test',passwordRef:'test-secret',sender:'sender@example.invalid',destination:'recipient@example.invalid',timeoutMs:200},{async resolve(){return 'secret';}});
  return {transport,getData:()=>data,close:()=>new Promise<void>((r,e)=>server.close(err=>err?e(err):r()))};
 }
 const message={from:'sender@example.invalid',to:'recipient@example.invalid',subject:'Invitation',text:'Local-only test URL',html:'<p>Local test</p>'};
 it('exchanges a real SMTP session and only reports acceptance on SMTP250',async()=>{const s=await smtp();try{expect(await s.transport.send(message,'test-invitation',new AbortController().signal)).toEqual({receiptRef:'smtp:test-invitation'});expect(s.getData()).toContain('Local-only test URL');}finally{await s.close();}});
 it('does not retry after unknown DATA outcome',async()=>{const s=await smtp(true);try{await expect(s.transport.send(message,'test-interrupted',new AbortController().signal)).rejects.toMatchObject({classification:'unknown',safeCode:'SMTP_DATA_OUTCOME_UNKNOWN'});}finally{await s.close();}});
});
