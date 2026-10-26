import {createClient} from '@libsql/client/web';
import {catalog} from './catalog.js';
import {initialState,product,quote,placeOrder,findOrder} from './commerce.js';

// One atomic state row keeps the academic demo small; write transactions serialize
// stock checks and order creation across independent Vercel function instances.
export async function createCloudStore({client}={}) {
  if(!client&&(!process.env.TURSO_DATABASE_URL||!process.env.TURSO_AUTH_TOKEN))throw new Error('Hosted database is not configured.');
  const db=client||createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
  await db.batch([
    'CREATE TABLE IF NOT EXISTS offset_state (id INTEGER PRIMARY KEY CHECK(id=1), state_json TEXT NOT NULL)',
    {sql:'INSERT OR IGNORE INTO offset_state (id,state_json) VALUES (1,?)',args:[JSON.stringify(initialState())]}
  ],'write');
  async function read(connection=db) {
    const result=await connection.execute('SELECT state_json FROM offset_state WHERE id=1');
    if(!result.rows[0])throw new Error('Store state is missing.');
    return JSON.parse(String(result.rows[0].state_json));
  }
  return {
    async products(){const state=await read();return catalog.map(item=>product(state,item.id));},
    async product(id){return product(await read(),id);},
    async quote(items){return quote(items,await read());},
    async order(reference){return findOrder(await read(),reference);},
    async createOrder(input){
      for(let attempt=0;;attempt++){
        let tx;
        try {tx=await db.transaction('write');
          const state=await read(tx),order=placeOrder(state,input);
          await tx.execute({sql:'UPDATE offset_state SET state_json=? WHERE id=1',args:[JSON.stringify(state)]});
          await tx.commit();return order;
        }catch(error){
          if(tx)await tx.rollback().catch(()=>{});
          if(attempt>=4||!['SQLITE_BUSY','SQLITE_LOCKED'].includes(error.code))throw error;
          await new Promise(resolve=>setTimeout(resolve,50*(attempt+1)));
        }finally{tx?.close();}
      }
    }
  };
}
