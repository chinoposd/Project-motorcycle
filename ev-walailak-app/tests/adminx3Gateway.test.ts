import assert from 'node:assert/strict';
import { test } from 'node:test';

test('vehicle request signatures bind timestamp method path and body', async () => {
  const { signGatewayRequest, verifyGatewayRequest } = await import('../supabase/functions/_shared/gateway-auth.ts');
  const now=Date.now(); const timestamp=String(now); const secret='an-independent-vehicle-secret-for-tests';
  const signature=await signGatewayRequest(secret,timestamp,'POST','/vehicle-gateway/events','{"event_id":"one"}');
  assert.equal(await verifyGatewayRequest(secret,timestamp,signature,'POST','/vehicle-gateway/events','{"event_id":"one"}',now),true);
  assert.equal(await verifyGatewayRequest(secret,timestamp,signature,'POST','/vehicle-gateway/events','{"event_id":"changed"}',now),false);
  assert.equal(await verifyGatewayRequest(secret,timestamp,signature,'GET','/vehicle-gateway/commands','',now),false);
  assert.equal(await verifyGatewayRequest(secret,timestamp,signature,'POST','/vehicle-gateway/events','{"event_id":"one"}',now+360000),false);
});

test('offline manifests have a verifiable signature and reject lifetime above 24 hours', async () => {
  const { signOfflineManifest } = await import('../supabase/functions/_shared/offline-manifest.ts');
  const keys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
  const privateJwk=await crypto.subtle.exportKey('jwk',keys.privateKey);
  const payload={ vehicle_id:'EV-01',version:4,issued_at:'2026-10-26T00:00:00.000Z',expires_at:'2026-10-27T00:00:00.000Z',key_id:'test-key',cards:[] };
  const signed=await signOfflineManifest(payload,privateJwk);
  const signature=Uint8Array.from(atob(signed.signature), c=>c.charCodeAt(0));
  assert.equal(await crypto.subtle.verify('Ed25519',keys.publicKey,signature,new TextEncoder().encode(signed.payload)),true);
  await assert.rejects(signOfflineManifest({...payload,expires_at:'2026-10-27T00:00:01.000Z'},privateJwk),/24 hours/i);
});
