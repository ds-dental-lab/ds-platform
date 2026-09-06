// 푸시 시험으로 남긴 문의·종을 지웁니다
import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,S=env.SUPABASE_SERVICE_ROLE_KEY;const h={apikey:S,Authorization:'Bearer '+S,'Content-Type':'application/json'};
const rest=async(p)=>(await fetch(U+'/rest/v1/'+encodeURI(p),{headers:h})).json();
if (process.argv[2]==='check') {
  const c=await rest('contact_requests?select=clinic_name,created_at&clinic_name=like.푸시 시험*');
  const n=await rest('notifications?select=event_type,body,created_at&event_type=eq.contact.requested&body=like.푸시 시험*');
  console.log('문의 줄', JSON.stringify(c)); console.log('종', JSON.stringify(n)); process.exit(0);
}
const a=await fetch(U+'/rest/v1/'+encodeURI('contact_requests?clinic_name=like.푸시 시험*'),{method:'DELETE',headers:h});
const b=await fetch(U+'/rest/v1/'+encodeURI('notifications?event_type=eq.contact.requested&body=like.푸시 시험*'),{method:'DELETE',headers:h});
console.log('문의 지움',a.status,'· 종 지움',b.status);
