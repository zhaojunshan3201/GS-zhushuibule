import os
os.chdir(r"C:\ZS\gszhushuiSQL")
with open("da-oracle-part1.ts", "r", encoding="utf-8") as f:
    part1 = f.read()
with open("da-oracle-part2.ts", "r", encoding="utf-8") as f:
    part2 = f.read()
combined = part1 + "\n" + part2
with open("server.ts", "r", encoding="utf-8") as f:
    content = f.read()
marker = 'app.get("/api/well-measures"'
if marker in content:
    content = content.replace(marker, combined + "\n\n" + marker)
    with open("server.ts", "w", encoding="utf-8") as f:
        f.write(content)
    print("Inserted successfully")
else:
    print("Marker NOT found")
