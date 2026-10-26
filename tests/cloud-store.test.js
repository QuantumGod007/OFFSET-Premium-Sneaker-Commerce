import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createClient} from '@libsql/client';
import request from 'supertest';
import {createCloudStore} from '../server/cloud-store.js';
import {createApp} from '../server/app.js';

const customer={name:'Hosted Demo',email:'demo@example.com',phone:'9876543210',address:'12 Sample Road, Shivajinagar',city:'Pune',pincode:'411005'};
const input=(productId='nb-9060',size=11)=>({customer,items:[{productId,size,quantity:1}]});

test('hosted storage validates checkout, commits atomically and survives a new instance',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'offset-cloud-'));
  const options={url:'file:'+join(directory,'store.db')};
  let db=createClient(options),second;
  try {
    await db.execute('PRAGMA journal_mode=WAL');
    const store=await createCloudStore({client:db});
    const {app}=await createApp(undefined,{store});
    await request(app).post('/api/orders').send({...input(),customer:{...customer,email:'invalid'}}).expect(422);
    await request(app).post('/api/orders').send({...input(),items:[{...input().items[0],price:1}]}).expect(422);
    await request(app).post('/api/orders').send(input('unknown-product')).expect(404);
    const before=(await store.product('nike-dunk-low')).stock['8'];
    await request(app).post('/api/orders').send({...input(),items:[{productId:'nike-dunk-low',size:8,quantity:1},{productId:'nb-9060',size:6,quantity:1}]}).expect(409);
    assert.equal((await store.product('nike-dunk-low')).stock['8'],before);
    const result=await request(app).post('/api/orders').send(input()).expect(201);
    assert.equal(result.body.data.total,14999);
    assert.equal(result.body.data.customer,undefined);
    const reference=result.body.data.reference;
    db.close();db=createClient(options);
    const reopened=await createCloudStore({client:db});
    assert.equal((await reopened.order(reference)).reference,reference);
    assert.equal((await reopened.product('nb-9060')).stock['11'],0);
    await assert.rejects(()=>reopened.createOrder(input()),{code:'OUT_OF_STOCK'});
    second=createClient(options);
    const other=await createCloudStore({client:second});
    const outcomes=await Promise.allSettled([reopened.createOrder(input('adidas-samba')),other.createOrder(input('adidas-samba'))]);
    assert.equal(outcomes.filter(outcome=>outcome.status==='fulfilled').length,1);
    assert.equal(outcomes.filter(outcome=>outcome.status==='rejected'&&outcome.reason.code==='OUT_OF_STOCK').length,1);
    assert.equal((await other.product('adidas-samba')).stock['11'],0);
    assert.equal((await reopened.product('adidas-samba')).stock['11'],0);
  }finally{db.close();second?.close();await rm(directory,{recursive:true,force:true});}
});
