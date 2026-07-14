with open(r"C:\ZS\gszhushuiSQL\src\App.tsx", "r", encoding="utf-8") as f:
    t = f.read()

# The current block options start with <option value="">全部区块</option> followed by <option>雷家L</option> etc.
# Find and replace the entire block option group in filter dropdowns

old_block_group = '''            <option value="">全部区块</option>
            <option>雷家L</option>
            <option>雷家D</option>
            <option>雷64水驱</option>
            <option>雷72</option>
            <option>牛心坨N1-3</option>
            <option>牛心坨潜山</option>
            <option>坨33</option>'''

new_block_group = '''            <option value="">全部区块</option>
            <option>高18(南)</option>
            <option>高升零散井(采一)</option>
            <option>雷64氮气驱</option>
            <option>雷64水驱</option>
            <option>雷72</option>
            <option>雷家D</option>
            <option>雷家L</option>
            <option>牛心坨N1-3</option>
            <option>牛心坨N4-5</option>
            <option>牛心坨N6-7</option>
            <option>牛心坨零散井</option>
            <option>牛心坨潜山</option>
            <option>宋1未开发区</option>
            <option>坨19</option>
            <option>坨25</option>
            <option>坨32未开发区</option>
            <option>坨33</option>
            <option>246块L1-4</option>
            <option>246块L5</option>
            <option>246块L6</option>
            <option>3618块L4</option>
            <option>3618块L5</option>
            <option>3618块L6</option>
            <option>3624块(北)L5</option>
            <option>3624块(北)L6</option>
            <option>3624块(南)L5</option>
            <option>3624块(南)L6</option>
            <option>3块L5</option>
            <option>3块L6</option>
            <option>3块L7</option>
            <option>高10</option>
            <option>高101</option>
            <option>高18(北)</option>
            <option>高21(北)</option>
            <option>高21(南)</option>
            <option>高372108</option>
            <option>高81</option>
            <option>高二三区高升油层未</option>'''

count = t.count(old_block_group)
t = t.replace(old_block_group, new_block_group)
print(f"Block dropdown replaced: {count} occurrences")

with open(r"C:\ZS\gszhushuiSQL\src\App.tsx", "w", encoding="utf-8") as f:
    f.write(t)
print("App.tsx updated")