t = open(r"C:\ZS\gszhushuiSQL\server.ts", "r", encoding="utf-8").read()
import re
# count using unicode escapes
c1 = t.count("\u96f711")
c2 = t.count("\u96f764")
c3 = t.count("\u725b\u5fc3\u5768")
print("counts:", c1, c2, c3)
# do replacements
t = t.replace("\u96f711", "\u96f7\u5bb6L")
t = t.replace("\u96f764", "\u96f764\u6c34\u9a71")
t = t.replace("\u725b\u5fc3\u5768", "\u725b\u5fc3\u5768N1-3")
open(r"C:\ZS\gszhushuiSQL\server.ts", "w", encoding="utf-8").write(t)
print("DONE")