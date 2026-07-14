with open(r"C:\ZS\gszhushuiSQL\src\App.tsx", "r", encoding="utf-8") as f:
    t = f.read()

# Count occurrences of current block names
for name in ["雷家L", "雷家D", "雷64水驱", "雷72", "牛心坨N1-3", "牛心坨潜山", "坨33"]:
    c = t.count(f"<option>{name}</option>")
    if c > 0:
        print(f"found {name}: {c}")