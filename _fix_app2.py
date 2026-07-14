t = open(r"C:\ZS\gszhushuiSQL\src\App.tsx", "r", encoding="utf-8").read()
# Change default unit from specific value to empty (show all)
old = 'unit: "高采采油作业一区"'
new = 'unit: ""'
c = t.count(old)
t = t.replace(old, new)
open(r"C:\ZS\gszhushuiSQL\src\App.tsx", "w", encoding="utf-8").write(t)
print("replaced:", c)