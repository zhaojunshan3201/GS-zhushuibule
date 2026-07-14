t = open(r"C:\ZS\gszhushuiSQL\src\App.tsx", "r", encoding="utf-8").read()
old = 'unit: event.target.value })'
new = 'unit: event.target.value, block: "" })'
c = t.count(old)
t = t.replace(old, new)
open(r"C:\ZS\gszhushuiSQL\src\App.tsx", "w", encoding="utf-8").write(t)
print("Fixed:", c)