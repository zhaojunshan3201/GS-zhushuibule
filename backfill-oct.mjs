// 补回采油作业一区 2025-10 的数据
const res = await fetch('http://localhost:5000/api/admin/oracle-history/backfill', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dataset: 'production_history',
    unit: 'all',
    factoryName: '%高升采油厂%',
    startDate: '20251001',
    endDate: '20251031',
    dryRun: false,
    rebuildSnapshots: true
  })
});
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
