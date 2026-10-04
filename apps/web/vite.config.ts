import { defineConfig, type Plugin } from 'vite';
import { createReadStream, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

// Vite doesn't infer an APK MIME type. Serve this exact public release artifact,
// not a directory listing or the SPA fallback, in dev and preview.
const apkDownload:Plugin={
  name:'borneo-apk-download',
  configureServer(server){serveApk(server)},
  configurePreviewServer(server){serveApk(server)},
};
function serveApk(server:{middlewares:{use:Function}}){
  server.middlewares.use((request:import('node:http').IncomingMessage,response:import('node:http').ServerResponse,next:()=>void)=>{
    if(request.url?.split('?')[0]!=='/downloads/borneo-marketplace.apk')return next();
    if(request.method!=='GET'&&request.method!=='HEAD'){response.statusCode=405;response.end();return}
    const path=fileURLToPath(new URL('./public/downloads/borneo-marketplace.apk',import.meta.url));
    let size:number;
    try{size=statSync(path).size}catch{response.statusCode=404;response.end();return}
    response.setHeader('Content-Type','application/vnd.android.package-archive');
    response.setHeader('Content-Disposition','attachment; filename="borneo-marketplace.apk"');
    response.setHeader('Content-Length',size);response.setHeader('Cache-Control','no-cache');
    response.setHeader('X-Content-Type-Options','nosniff');
    if(request.method==='HEAD'){response.end();return}
    const stream=createReadStream(path);stream.on('error',()=>response.destroy());stream.pipe(response);
  });
}
export default defineConfig({
  plugins:[react(),apkDownload],
  // Embedded WebViews can lag behind desktop Chrome. In particular, converting
  // max-width queries to range syntax makes older engines ignore EVERY mobile rule.
  build:{target:['chrome79','safari14'],cssTarget:['chrome79','safari14']},
  server:{host:'127.0.0.1',port:5173,proxy:{'/api':'http://127.0.0.1:4000'}},
});
