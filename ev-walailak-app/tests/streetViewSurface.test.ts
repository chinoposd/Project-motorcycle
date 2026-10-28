import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('real and demo vehicle maps replace the old SVG basemap with Street View',async()=>{
  const vite=await createServer({server:{middlewareMode:true,hmr:false}});
  try {
    const {default:VehicleLiveMap}=await vite.ssrLoadModule('/src/features/operations/VehicleLiveMap.tsx');
    const {default:CampusMap}=await vite.ssrLoadModule('/src/components/CampusMap.tsx');
    const real=renderToStaticMarkup(React.createElement(VehicleLiveMap,{fix:{latitude:8.641,longitude:99.898,gpsAt:new Date().toISOString(),fresh:true,sessionActive:true}}));
    const demo=renderToStaticMarkup(React.createElement(CampusMap,{manager:true}));
    assert.doesNotMatch(real,/ops-live-map-plot/);
    assert.doesNotMatch(demo,/class="map-art"/);
    assert.match(real,/Street View/);
    assert.match(demo,/Street View/);
    assert.doesNotMatch(real,/<iframe/);
  } finally {await vite.close();}
});
