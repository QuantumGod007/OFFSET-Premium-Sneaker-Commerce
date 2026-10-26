import {readFile,mkdir,open,rename,unlink} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {catalog} from './catalog.js';
import {initialState,product,quote,placeOrder,findOrder} from './commerce.js';

async function atomicSave(path,state) {
  await mkdir(dirname(path),{recursive:true});
  const temporary=`${path}.${randomUUID()}.tmp`;
  let file;
  try {
    file=await open(temporary,'wx',0o600);
    await file.writeFile(JSON.stringify(state)); await file.sync(); await file.close(); file=undefined;
    await rename(temporary,path);
  } finally {if(file) await file.close();await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}
export async function createStore(path=process.env.DATA_PATH||'data/store.json',{save=atomicSave}={}) {
  let state;
  try {state=JSON.parse(await readFile(path,'utf8'));if(state.version!==1||!state.stock||!Array.isArray(state.orders))throw new Error('Invalid saved store data.');}
  catch(error) {if(error.code!=='ENOENT')throw error;state=initialState();await save(path,state);}
  let queue=Promise.resolve();
  return {
    async products(){await queue;return catalog.map(item=>product(state,item.id));},
    async product(id){await queue;return product(state,id);},
    async quote(items){await queue;return quote(items,state);},
    async order(reference){await queue;return findOrder(state,reference);},
    createOrder(input){
      const operation=queue.then(async()=>{
        const next=structuredClone(state),order=placeOrder(next,input);
        await save(path,next);state=next;return order;
      });
      queue=operation.then(()=>undefined,()=>undefined);return operation;
    }
  };
}
