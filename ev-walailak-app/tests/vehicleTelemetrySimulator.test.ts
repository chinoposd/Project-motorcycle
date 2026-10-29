import assert from 'node:assert/strict';
import { test } from 'node:test';
import { vehicleMapState } from '../src/features/operations/vehicleMapState.ts';
import { createVehicleTelemetrySample } from '../src/features/operations/vehicleTelemetrySimulator.ts';

test('empty simulation never invents a vehicle position', () => {
  const sample = createVehicleTelemetrySample('empty', 1_800_000_000_000);
  assert.equal(sample.fix.latitude, null);
  assert.equal(sample.fix.longitude, null);
  assert.equal(sample.fix.gpsAt, null);
  assert.equal(sample.fix.fresh, null);
});

test('live simulation emits a fresh in-range position and active session', () => {
  const now = 1_800_000_000_000;
  const sample = createVehicleTelemetrySample('live', now, 1);
  assert.equal(sample.fix.gpsAt, new Date(now).toISOString());
  assert.equal(sample.fix.fresh, true);
  assert.equal(sample.fix.sessionActive, true);
  assert.equal(vehicleMapState(sample.fix, now).kind, 'live');
  assert.ok(sample.fix.latitude !== null && Math.abs(sample.fix.latitude) <= 90);
  assert.ok(sample.fix.longitude !== null && Math.abs(sample.fix.longitude) <= 180);
});

test('stale simulation is displayed as an old fix, never a live fix', () => {
  const now = 1_800_000_000_000;
  const sample = createVehicleTelemetrySample('stale', now);
  assert.equal(sample.fix.fresh, false);
  assert.equal(vehicleMapState(sample.fix, now).kind, 'stale');
});

test('offline simulation retains only a stale last-known position', () => {
  const now = 1_800_000_000_000;
  const sample = createVehicleTelemetrySample('offline', now);
  assert.equal(sample.fix.fresh, false);
  assert.equal(sample.fix.sessionActive, false);
  assert.equal(vehicleMapState(sample.fix, now).kind, 'stale');
});

test('live simulation advances along the sample route without leaving valid coordinates', () => {
  const first = createVehicleTelemetrySample('live', 1_800_000_000_000, 0).fix;
  const second = createVehicleTelemetrySample('live', 1_800_000_000_000, 1).fix;
  assert.notDeepEqual([first.latitude, first.longitude], [second.latitude, second.longitude]);
});
