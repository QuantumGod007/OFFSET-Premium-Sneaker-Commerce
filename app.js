import express from 'express';
import {createApp} from './server/app.js';
import {createCloudStore} from './server/cloud-store.js';

const app=express();
let initialized;
app.use(async(req,res,next)=>{
  try {
    initialized||=createCloudStore().then(store=>createApp(undefined,{store})).catch(error=>{initialized=undefined;throw error;});
    const service=await initialized;
    service.app(req,res,next);
  }catch(error){
    console.error('OFFSET initialization failed:',error.message);
    res.status(503).set('Cache-Control','no-store').json({success:false,error:'SERVICE_UNAVAILABLE',message:'The store is temporarily unavailable. Please try again shortly.'});
  }
});
export default app;
