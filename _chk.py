t = open(r"C:\ZS\gszhushuiSQL\server.ts", "r", encoding="utf-8").read()
i = t.find('dynamic-analysis-seed')
chunk = t[i:i+800]
import re
for m in re.finditer(r'unit: "([^"]+)"', chunk):
    u = m.group(1)
    print(f'unit: hex={[hex(ord(c)) for c in u]} len={len(u)}')