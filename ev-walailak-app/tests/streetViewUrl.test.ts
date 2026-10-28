import assert from 'node:assert/strict';
import {test} from 'node:test';
import {streetViewEmbedUrl,streetViewUrl} from '../src/features/operations/streetViewUrl.ts';

test('builds the official Street View Maps URL from a GPS point',()=>{
  const url=new URL(streetViewUrl(8.641,99.898)!);
  assert.equal(url.origin,'https://www.google.com');
  assert.equal(url.pathname,'/maps/@');
  assert.equal(url.searchParams.get('api'),'1');
  assert.equal(url.searchParams.get('map_action'),'pano');
  assert.equal(url.searchParams.get('viewpoint'),'8.641,99.898');
});

test('does not produce a Street View link for invalid coordinates',()=>{
  assert.equal(streetViewUrl(91,99.898),null);
  assert.equal(streetViewUrl(8.641,NaN),null);
});

test('embeds Street View only when a Google Maps Embed key is configured',()=>{
  assert.equal(streetViewEmbedUrl(8.641,99.898,''),null);
  assert.equal(streetViewEmbedUrl(91,99.898,'AIza12345678901234567890123456789012345'),null);
  const url=new URL(streetViewEmbedUrl(8.641,99.898,'AIza12345678901234567890123456789012345')!);
  assert.equal(url.pathname,'/maps/embed/v1/streetview');
  assert.equal(url.searchParams.get('location'),'8.641,99.898');
  assert.equal(url.searchParams.get('language'),'th');
});
