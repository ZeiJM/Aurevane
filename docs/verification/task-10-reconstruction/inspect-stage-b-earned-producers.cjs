const fs=require('fs'), path=require('path');
const root=process.cwd();
const {PGlite}=require(path.join(root,'packages/db/node_modules/@electric-sql/pglite'));
(async()=>{
 const db=await PGlite.create();
 const fixture=fs.readFileSync(path.join(root,'packages/db/src/combat-content-record-lifecycle.test.ts'),'utf8');
 const setup=fixture.match(/await db\.exec\(`(create role anon;[\s\S]*?)`\)/)[1];
 await db.exec(setup);
 let count=0;
 for(const name of fs.readdirSync(path.join(root,'supabase/migrations')).filter(n=>n.endsWith('.sql')).sort()){
  const sql=fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8').replace(/create extension if not exists pg_cron(?: with schema pg_catalog)?;/gi,'').replace(/set compression lz4/gi,'set compression pglz');
  try{await db.exec(sql);count++;}catch(error){throw new Error(name+': '+error.message)}
 }
 const out='/tmp/task10-stage-b-earned-sql';fs.mkdirSync(out,{recursive:true});
 const rows=(await db.query("select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) body from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.prokind='f' and (p.prosrc ~ 'character_skill_unlocks|character_build_discipline_skills|discipline_skills') order by n.nspname,p.proname,p.oid")).rows;
 const index=[];
 for(let i=0;i<rows.length;i++){const r=rows[i];const name=`${r.nspname}.${r.proname}-${i}.sql`;fs.writeFileSync(path.join(out,name),r.body);index.push({file:name,args:r.args});}
 fs.writeFileSync(path.join(out,'index.json'),JSON.stringify(index,null,2));
 const tables=(await db.query("select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='app_private' and table_name ~ 'discipline|skill|build|attribute' order by table_name,ordinal_position")).rows;
 fs.writeFileSync(path.join(out,'tables.json'),JSON.stringify(tables,null,2));
 console.log(JSON.stringify({migrations:count,functionCount:rows.length,columnCount:tables.length,output:out,limits:'PGlite environment shim; LZ4 storage substitution; read-only schema inventory, no physical concurrency claim'}));
 await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
