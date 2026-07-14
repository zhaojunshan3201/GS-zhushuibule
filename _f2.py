t = open(r"C:\ZS\gszhushuiSQL\server.ts", "r", encoding="utf-8").read()
idx = t.find('const blocks')
chunk = t[idx:idx+800]
# Count distinct units
import re
units = re.findall(r'unit: "([^"]+)"', chunk)
for u in units:
    print(len(u), 'chars:', [hex(ord(c)) for c in u])