import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createApp} from '../server/app.js';
import {catalog} from '../server/catalog.js';

let dir,path,app,store;
before(async()=>{dir=await mkdtemp(join(tmpdir(),'offset-test-'));path=join(dir,'store.json');({app,store}=await createApp(path));});
after(async()=>{await rm(dir,{recursive:true,force:true});});
const customer=()=>({name:'  Demo Customer  ',email:'DEMO@example.com',phone:'+91 98765 43210',address:'Flat 12, Sample Road, Shivajinagar',city:'Pune',pincode:'411005'});
const order=()=>({customer:customer(),items:[{productId:'nike-dunk-low',size:8,quantity:1}]});

test('GET catalog, details, filters, search, and security headers',async()=>{
  const result=await request(app).get('/api/products').expect(200);assert.equal(result.body.data.products.length,8);assert.equal(result.body.success,true);assert.equal(result.headers['x-powered-by'],undefined);assert.equal(result.headers['cache-control'],'no-store');assert.ok(result.headers['content-security-policy']);
  const detail=await request(app).get('/api/products/nb-9060').expect(200);assert.equal(detail.body.data.name,'9060');assert.equal(detail.body.data.stock['6'],0);assert.equal(detail.body.data.initialStock,undefined);
  const runners=await request(app).get('/api/products?category=runners').expect(200);assert.ok(runners.body.data.products.every(p=>p.category==='runners'));
  const search=await request(app).get('/api/products?search=samba').expect(200);assert.equal(search.body.data.products.length,1);
  const brand=await request(app).get('/api/products?brand=ASICS').expect(200);assert.equal(brand.body.data.products.length,2);
  const empty=await request(app).get('/api/products?search=not-a-shoe').expect(200);assert.deepEqual(empty.body.data.products,[]);
  await request(app).get('/api/products?category=bad').expect(400);await request(app).get('/api/products?search[]=a').expect(400);await request(app).get('/api/products?search='+'x'.repeat(101)).expect(400);
  await request(app).get('/api/products/missing-shoe').expect(404);await request(app).get('/api/products/!!').expect(400);await request(app).get('/api/unknown').expect(404);await request(app).get('/api/health').expect(200);
});
test('server quotes prices and shipping without creating an order',async()=>{
  const before=(await readFile(path,'utf8'));
  const result=await request(app).post('/api/cart/quote').send({items:order().items}).expect(200);assert.equal(result.body.data.subtotal,8995);assert.equal(result.body.data.shipping,199);assert.equal(result.body.data.total,9194);
  const free=await request(app).post('/api/cart/quote').send({items:[{productId:'nb-9060',size:8,quantity:1}]}).expect(200);assert.equal(free.body.data.shipping,0);assert.equal(free.body.data.total,14999);
  assert.equal(await readFile(path,'utf8'),before);
});
test('checkout validation accepts valid details and does not mutate stock',async()=>{
  const before=(await store.product('nike-dunk-low')).stock['8'];await request(app).post('/api/checkout/validate').send(order()).expect(200);assert.equal((await store.product('nike-dunk-low')).stock['8'],before);
});
test('server rejects required, invalid and wrongly typed customer fields',async t=>{
  const cases=[['missing name',{name:undefined}],['blank name',{name:'   '}],['long name',{name:'x'.repeat(101)}],['name type',{name:25}],['control character',{name:'Demo\nGuest'}],['invalid email',{email:'not-an-email'}],['missing email',{email:undefined}],['email type',{email:12}],['invalid phone',{phone:'1234567890'}],['short phone',{phone:'98765'}],['numeric phone',{phone:9876543210}],['missing address',{address:undefined}],['short address',{address:'Pune'}],['long address',{address:'x'.repeat(241)}],['missing city',{city:undefined}],['invalid city',{city:'Pune123'}],['invalid PIN',{pincode:'012345'}],['numeric PIN',{pincode:411005}],['missing PIN',{pincode:undefined}]];
  for(const [name,patch] of cases)await t.test(name,async()=>{const result=await request(app).post('/api/orders').send({...order(),customer:{...customer(),...patch}}).expect(422);assert.equal(result.body.success,false);assert.ok(result.body.fields);assert.ok(result.body.message);});
  await request(app).post('/api/orders').send({items:order().items}).expect(422);await request(app).post('/api/orders').send({...order(),customer:[]}).expect(422);
});
test('cart shape, quantities, size selection and duplicate items are validated',async t=>{
  const item=order().items[0];
  const cases=[['missing cart',undefined],['empty cart',[]],['not an array',{}],['invalid line',[null]],['invalid product ID',[{...item,productId:1}]],['size type',[{...item,size:'8'}]],['invalid size',[{...item,size:12}]],['zero quantity',[{...item,quantity:0}]],['negative quantity',[{...item,quantity:-1}]],['decimal quantity',[{...item,quantity:1.5}]],['string quantity',[{...item,quantity:'1'}]],['oversized quantity',[{...item,quantity:6}]],['duplicate item',[item,item]],['too many lines',Array(21).fill(item)]];
  for(const [name,items] of cases)await t.test(name,async()=>{await request(app).post('/api/orders').send({...order(),items}).expect(422);});
});
test('unknown products, unavailable sizes and excess stock are rejected',async()=>{
  await request(app).post('/api/orders').send({...order(),items:[{productId:'unknown-shoe',size:8,quantity:1}]}).expect(404);
  const soldOut=await request(app).post('/api/orders').send({...order(),items:[{productId:'nb-9060',size:6,quantity:1}]}).expect(409);assert.equal(soldOut.body.error,'OUT_OF_STOCK');
  await request(app).post('/api/orders').send({...order(),items:[{productId:'nb-9060',size:10,quantity:3}]}).expect(409);
});
test('tampered prices, totals and unexpected properties never affect orders',async()=>{
  for(const patch of [{price:1},{subtotal:1},{total:1},{shipping:0},{admin:true}])await request(app).post('/api/orders').send({...order(),...patch}).expect(422);
  await request(app).post('/api/orders').send({...order(),items:[{...order().items[0],price:1}]}).expect(422);
  await request(app).post('/api/orders').send({...order(),customer:{...customer(),verified:true}}).expect(422);
});
test('malformed JSON, wrong body shape, wrong content type and large requests return proper status',async()=>{
  await request(app).post('/api/orders').set('Content-Type','application/json').send('{bad-json').expect(400);
  for(const body of [null,[],1,'hello'])await request(app).post('/api/orders').set('Content-Type','application/json').send(JSON.stringify(body)).expect(400);
  await request(app).post('/api/orders').set('Content-Type','text/plain').send('hello').expect(400);
  await request(app).post('/api/orders').send({...order(),customer:{...customer(),address:'x'.repeat(20000)}}).expect(413);
});
let reference;
test('valid order saves normalized customer details, server totals and inventory',async()=>{
  const result=await request(app).post('/api/orders').send(order()).expect(201);const saved=result.body.data;reference=saved.reference;
  assert.match(reference,/^OF-[A-F0-9]{24}$/);assert.equal(saved.status,'confirmed');assert.equal(saved.total,9194);assert.equal(saved.demo,true);assert.equal(saved.customer,undefined);
  assert.equal((await store.product('nike-dunk-low')).stock['8'],3);
  const state=JSON.parse(await readFile(path,'utf8'));const row=state.orders.find(o=>o.reference===reference);assert.equal(row.customer.name,'Demo Customer');assert.equal(row.customer.email,'demo@example.com');assert.equal(row.customer.phone,'9876543210');
  const lookup=await request(app).get('/api/orders/'+reference).expect(200);assert.equal(lookup.body.data.total,9194);assert.equal(lookup.body.data.items[0].size,8);assert.equal(lookup.body.data.customer,undefined);
});
test('concurrent orders cannot oversell the final pair',async()=>{
  const input={...order(),items:[{productId:'nb-9060',size:11,quantity:1}]};
  const results=await Promise.all(Array.from({length:5},()=>request(app).post('/api/orders').send(input)));
  assert.equal(results.filter(r=>r.status===201).length,1);assert.equal(results.filter(r=>r.status===409).length,4);assert.equal((await store.product('nb-9060')).stock['11'],0);
});
test('multi-item failure is atomic and leaves valid item stock untouched',async()=>{
  const before=(await store.product('nike-dunk-low')).stock['9'];
  await request(app).post('/api/orders').send({...order(),items:[{productId:'nike-dunk-low',size:9,quantity:1},{productId:'nb-9060',size:6,quantity:1}]}).expect(409);
  assert.equal((await store.product('nike-dunk-low')).stock['9'],before);
});
test('orders and depleted inventory persist after reopening the store',async()=>{
  const reopened=await createApp(path);const saved=await request(reopened.app).get('/api/orders/'+reference).expect(200);assert.equal(saved.body.data.total,9194);assert.equal((await reopened.store.product('nb-9060')).stock['11'],0);
  await request(reopened.app).get('/api/orders/invalid').expect(400);await request(reopened.app).get('/api/orders/OF-000000000000000000000000').expect(404);
});
test('failed disk persistence never commits an order or decrements stock',async()=>{
  const failing=await createApp(path,{save:async()=>{throw new Error('Simulated write failure');}});
  const before=(await failing.store.product('nike-dunk-low')).stock['9'];
  await assert.rejects(()=>failing.store.createOrder({...order(),items:[{productId:'nike-dunk-low',size:9,quantity:1}]}),/Simulated write failure/);
  assert.equal((await failing.store.product('nike-dunk-low')).stock['9'],before);
});
test('catalog photos, local fallbacks and fonts are available',async()=>{
  for(const product of catalog)for(const property of ['image','fallback']){const bytes=await readFile(new URL('../public'+product[property],import.meta.url));assert.ok(bytes.length>2000);assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);}
  for(const file of ['space-grotesk.css','dm-sans.css','FONT-LICENSES.txt','sources.json'])assert.ok((await readFile(new URL('../public/assets/'+file,import.meta.url))).length>50);
});
