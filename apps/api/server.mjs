import { createApp } from './app.mjs';
const app=createApp(); const port=Number(process.env.PORT||3001);const host=process.env.HOST||'127.0.0.1';
const server=app.listen(port,host,()=>console.log(`Optical Operator API: http://${host}:${port} · communications: mock`));
function stop(){server.close(()=>{app.locals.db.close();process.exit(0);});}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
