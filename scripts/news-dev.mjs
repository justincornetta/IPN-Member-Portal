import {appendFileSync,cpSync,existsSync,mkdirSync,rmSync,symlinkSync,writeFileSync,readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {spawn} from 'node:child_process'
const root=process.cwd(),target=resolve(root,'.qa-news')
mkdirSync(target,{recursive:true})
for(const name of ['src','public','assets']){rmSync(resolve(target,name),{recursive:true,force:true});cpSync(resolve(root,name),resolve(target,name),{recursive:true})}
for(const name of ['package.json','package-lock.json','tsconfig.json','postcss.config.mjs'])cpSync(resolve(root,name),resolve(target,name))
if(!existsSync(resolve(target,'node_modules')))symlinkSync(resolve(root,'node_modules'),resolve(target,'node_modules'),'dir')
writeFileSync(resolve(target,'next.config.ts'),`export default {turbopack:{root:${JSON.stringify(root)}}}\n`)
appendFileSync(resolve(target,"src/app/globals.css"),`\n@source "${root}/src";\n`)
const fixture=readFileSync(resolve(root,'qa/news/supabase.ts'),'utf8').replace('../../src/lib/resources/newsletter-snapshot.json','../resources/newsletter-snapshot.json')
for(const name of ['server','admin'])writeFileSync(resolve(target,`src/lib/supabase/${name}.ts`),fixture)
rmSync(resolve(target,'src/middleware.ts'))
// Analytics is not part of this read-only preview.
mkdirSync(resolve(target,'src/app/api/portal-analytics'),{recursive:true})
writeFileSync(resolve(target,'src/app/api/portal-analytics/route.ts'),'export async function POST(){return new Response(null,{status:204})}\n')
writeFileSync(resolve(target,'.gitignore'),'*\n')
const env={PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'development',NEXT_PUBLIC_SUPABASE_URL:'https://qa.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'qa-no-access'}
const child=spawn(process.execPath,[resolve(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','4341'],{cwd:target,env,stdio:'inherit'})
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal))
