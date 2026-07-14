import os
os.chdir(r"C:\ZS\gszhushuiSQL")

with open("server.ts", "r", encoding="utf-8") as f:
    content = f.read()

with open("seed-new.ts", "r", encoding="utf-8") as f:
    new_seed = f.read()

# Find the old seed endpoint
old_marker = 'app.post("/api/dynamic-analysis-seed"'
start = content.find(old_marker)
if start < 0:
    print("Old seed NOT FOUND")
    exit(1)

# Find the end of the old endpoint
# Look for the closing }); after the res.json
from_idx = content.find('res.json({ ok: true, total: });', start)
if from_idx < 0:
    from_idx = content.find('res.json({ ok: true, total });', start)
end = content.find('});', from_idx) if from_idx >= 0 else -1

if end < 0:
    print("End NOT FOUND")
    exit(1)

# Replace
content = content[:start] + new_seed.strip() + "\n" + content[end+3:]
with open("server.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("Seed endpoint replaced successfully, new length:", len(content))
