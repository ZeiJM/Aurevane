// Fresh, separate inventory; preserves all earlier producer evidence.
const fs = require('node:fs');
const source = fs.readFileSync('docs/verification/task-10-reconstruction/inspect-stage-b-producers.cjs', 'utf8');
const target = '/tmp/task10-stage-b-freeze-20261022-sql';
if (fs.existsSync(target)) throw new Error('Refusing to overwrite an existing freeze inventory');
eval(source.replace("'/tmp/task10-stage-b-current-sql'", JSON.stringify(target)));
