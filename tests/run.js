import {runCore} from './core.js';
const result=await runCore(t=>console.log(`${t.passed?'PASS':'FAIL'} ${t.name}${t.error?' — '+t.error:''}`));
console.log(`\n${result.total-result.failed}/${result.total} test groups passed`);if(result.failed)process.exitCode=1;
