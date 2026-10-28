import assert from 'node:assert/strict';
import {test} from 'node:test';
import {vehicleMapState} from '../src/features/operations/vehicleMapState.ts';

const now=Date.parse('2026-10-28T10:00:00Z');

test('never displays a live marker without a verified, recent GPS fix',()=>{
  assert.equal(vehicleMapState({latitude:null,longitude:null,gpsAt:null,fresh:true,sessionActive:true},now).kind,'waiting');
  assert.equal(vehicleMapState({latitude:7.93,longitude:98.39,gpsAt:new Date(now-5000).toISOString(),fresh:false,sessionActive:true},now).kind,'stale');
  assert.equal(vehicleMapState({latitude:7.93,longitude:98.39,gpsAt:new Date(now-31000).toISOString(),fresh:true,sessionActive:true},now).kind,'stale');
  assert.equal(vehicleMapState({latitude:999,longitude:98.39,gpsAt:new Date(now-5000).toISOString(),fresh:true,sessionActive:true},now).kind,'waiting');
});

test('only an active session with fresh GPS can be labelled live',()=>{
  const fix={latitude:8.641,longitude:99.898,gpsAt:new Date(now-5000).toISOString(),fresh:true};
  assert.equal(vehicleMapState({...fix,sessionActive:true},now).kind,'live');
  assert.equal(vehicleMapState({...fix,sessionActive:false},now).kind,'last-known');
  assert.equal(vehicleMapState({...fix,sessionActive:true},now+31000).kind,'stale');
});
