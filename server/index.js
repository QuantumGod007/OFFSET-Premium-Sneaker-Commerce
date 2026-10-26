import {createApp} from './app.js';
const {app}=await createApp();
const port=Number(process.env.PORT)||3001;
const server=app.listen(port,'0.0.0.0',()=>console.log(`OFFSET is ready at http://localhost:${port}`));
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
