import express from 'express';
import {fileURLToPath} from 'node:url';
import {createStore} from './store.js';
import {AppError,errorHandler} from './errors.js';
import {validateCart,validateCheckout} from './validation.js';
import {categories,shippingPolicy} from './catalog.js';

export async function createApp(dataPath,options) {
  const store=options?.store||await createStore(dataPath,options),app=express();
  app.disable('x-powered-by');
  app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",'X-Frame-Options':'DENY'});next();});
  app.use(express.json({limit:'16kb',strict:false}));
  app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');next();});
  const ok=(res,data,status=200)=>res.status(status).json({success:true,data});
  app.get('/api/health',(req,res)=>ok(res,{status:'ok'}));
  app.get('/api/products',async(req,res)=>{
    const {search='',category='',brand='',newArrival=''}=req.query;
    if(Object.keys(req.query).some(key=>!['search','category','brand','newArrival'].includes(key)))throw new AppError(400,'INVALID_QUERY','Use the search and filters shown in the shop.');
    if(!['','true','false'].includes(newArrival))throw new AppError(400,'INVALID_QUERY','Use true or false for the new arrival filter.');
    if([search,category,brand,newArrival].some(value=>typeof value!=='string')||search.length>100)throw new AppError(400,'INVALID_QUERY','Use a simple search of 100 characters or fewer.');
    if(category&&!categories.includes(category))throw new AppError(400,'INVALID_CATEGORY','Choose a category shown in the shop.');
    const products=(await store.products()).filter(p=>(!category||p.category===category)&&(!brand||p.brand.toLowerCase()===brand.toLowerCase())&&(newArrival!=='true'||p.newArrival)&&(`${p.brand} ${p.name} ${p.color}`.toLowerCase().includes(search.toLowerCase().trim())));
    ok(res,{products,categories,shippingPolicy,demo:true});
  });
  app.get('/api/products/:id',async(req,res)=>{
    if(!/^[a-z0-9][a-z0-9-]{2,49}$/.test(req.params.id))throw new AppError(400,'INVALID_PRODUCT_ID','Use a valid product ID.');
    ok(res,await store.product(req.params.id));
  });
  app.post('/api/cart/quote',validateCart,async(req,res)=>ok(res,await store.quote(req.body.items)));
  app.post('/api/checkout/validate',validateCheckout,async(req,res)=>ok(res,await store.quote(req.body.items)));
  app.post('/api/orders',validateCheckout,async(req,res)=>ok(res,await store.createOrder(req.body),201));
  app.get('/api/orders/:reference',async(req,res)=>{
    const reference=req.params.reference.toUpperCase();if(!/^OF-[A-F0-9]{24}$/.test(reference))throw new AppError(400,'INVALID_REFERENCE','Use the order reference from your confirmation.');
    ok(res,await store.order(reference));
  });
  app.use('/api',(req,res)=>res.status(404).json({success:false,error:'NOT_FOUND',message:'This API endpoint could not be found.'}));
  app.use(express.static(fileURLToPath(new URL('../public',import.meta.url)),{maxAge:process.env.NODE_ENV==='production'?'1h':0}));
  app.use((req,res)=>res.status(404).send('Page not found. Return to OFFSET at /.'));
  app.use(errorHandler);return {app,store};
}
