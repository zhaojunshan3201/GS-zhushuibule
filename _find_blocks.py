with open(r"C:\ZS\gszhushuiSQL\src\App.tsx", "r", encoding="utf-8") as f:
    t = f.read()

# Find block option groups
import re
# Find sequences of consecutive <option> tags that have Chinese block names
pattern = r'<option value="">全部区块</option>\s*(<option>[^<]+</option>\s*)+'
for m in re.finditer(pattern, t):
    print(f"Found at {m.start()}: {m.group()[:200]}")
    print("---")