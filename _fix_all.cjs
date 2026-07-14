
const fs = require('fs');

// Fix App.tsx
let app = fs.readFileSync('C:/ZS/gszhushuiSQL/src/App.tsx', 'utf8');

app = app.replace(/高升采油厂/g, '高采采油作业一区');

const oldUnitOpts = '<option>高采采油作业一区</option>\n            <option>采油作业二区</option>\n            <option>采油作业三区</option>';
const newUnitOpts = '<option>高采采油作业一区</option>\n            <option>高采采油作业二区</option>\n            <option>高采采油作业三区</option>';
app = app.replace(oldUnitOpts, newUnitOpts);

const oldSingleUnit = '<option value="">全部单位</option><option>高采采油作业一区</option>';
const newSingleUnit = '<option value="">全部单位</option><option>高采采油作业一区</option><option>高采采油作业二区</option><option>高采采油作业三区</option>';
app = app.replaceAll(oldSingleUnit, newSingleUnit);

const oldBlockOpts = '<option>雷11</option>\n            <option>雷64</option>\n            <option>雷72</option>\n            <option>牛心坨</option>\n            <option>牛心坨潜山</option>\n            <option>坨33</option>';
const newBlockOpts = '<option>雷家L</option>\n            <option>雷家D</option>\n            <option>雷64水驱</option>\n            <option>雷72</option>\n            <option>牛心坨N1-3</option>\n            <option>牛心坨潜山</option>\n            <option>坨33</option>';
app = app.replaceAll(oldBlockOpts, newBlockOpts);

fs.writeFileSync('C:/ZS/gszhushuiSQL/src/App.tsx', app, 'utf8');
console.log('App.tsx fixed');

// Fix server.ts seed
let server = fs.readFileSync('C:/ZS/gszhushuiSQL/server.ts', 'utf8');

server = server.replace(/高升采油厂/g, '高采采油作业一区');
server = server.replace(/name: "雷11"/g, 'name: "雷家L"');
server = server.replace(/block: "雷11"/g, 'block: "雷家L"');
server = server.replace(/name: "雷64"/g, 'name: "雷64水驱"');
server = server.replace(/block: "雷64"/g, 'block: "雷64水驱"');
server = server.replace(/name: "牛心坨"/g, 'name: "牛心坨N1-3"');
server = server.replace(/block: "牛心坨"/g, 'block: "牛心坨N1-3"');

fs.writeFileSync('C:/ZS/gszhushuiSQL/server.ts', server, 'utf8');
console.log('server.ts fixed');
