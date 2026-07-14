with open(r"C:\ZS\gszhushuiSQL\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find lines around 4229
for i in range(4225, 4270):
    if i < len(lines):
        print(f"{i+1}: {lines[i].rstrip()[:120]}")