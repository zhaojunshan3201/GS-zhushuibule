with open(r"C:\ZS\gszhushuiSQL\src\App.tsx", "r", encoding="utf-8") as f:
    t = f.read()

# Insert BLOCK_UNIT_MAP after the subMenus ]; closing
# Find:   ];\n\nconst groupHeaders
# Insert BLOCK_UNIT_MAP between ];

block_unit_code = '''
  const BLOCK_UNIT_MAP = {
    "高18(南)": "高采采油作业一区",
    "高升零散井(采一)": "高采采油作业一区",
    "雷64氮气驱": "高采采油作业一区",
    "雷64水驱": "高采采油作业一区",
    "雷72": "高采采油作业一区",
    "雷家D": "高采采油作业一区",
    "雷家L": "高采采油作业一区",
    "牛心坨N1-3": "高采采油作业二区",
    "牛心坨N4-5": "高采采油作业二区",
    "牛心坨N6-7": "高采采油作业二区",
    "牛心坨零散井": "高采采油作业二区",
    "牛心坨潜山": "高采采油作业二区",
    "宋1未开发区": "高采采油作业二区",
    "坨19": "高采采油作业二区",
    "坨25": "高采采油作业二区",
    "坨32未开发区": "高采采油作业二区",
    "坨33": "高采采油作业二区",
    "246块L1-4": "高采采油作业三区",
    "246块L5": "高采采油作业三区",
    "246块L6": "高采采油作业三区",
    "3618块L4": "高采采油作业三区",
    "3618块L5": "高采采油作业三区",
    "3618块L6": "高采采油作业三区",
    "3624块(北)L5": "高采采油作业三区",
    "3624块(北)L6": "高采采油作业三区",
    "3624块(南)L5": "高采采油作业三区",
    "3624块(南)L6": "高采采油作业三区",
    "3块L5": "高采采油作业三区",
    "3块L6": "高采采油作业三区",
    "3块L7": "高采采油作业三区",
    "高10": "高采采油作业三区",
    "高101": "高采采油作业三区",
    "高18(北)": "高采采油作业三区",
    "高21(北)": "高采采油作业三区",
    "高21(南)": "高采采油作业三区",
    "高372108": "高采采油作业三区",
    "高81": "高采采油作业三区",
    "高二三区高升油层未": "高采采油作业三区",
  };
  const ALL_BLOCKS = Object.keys(BLOCK_UNIT_MAP);
  const getFilteredBlocks = (unit: string) => {
    if (!unit) return ALL_BLOCKS;
    return ALL_BLOCKS.filter((b: string) => BLOCK_UNIT_MAP[b] === unit);
  };
'''

# Insert after   ];\n\nconst groupHeaders
old = '  ];\n\nconst groupHeaders'
new = '  ];\n' + block_unit_code + '\nconst groupHeaders'

if old in t:
    t = t.replace(old, new)
    print("BLOCK_UNIT_MAP inserted")
else:
    print("Pattern not found, searching...")
    i = t.find('  ];\n\nconst groupHeaders')
    if i > -1:
        print("Found at", i)
        t = t[:i+5] + '\n' + block_unit_code + '\n' + t[i+5:]
        print("Force inserted")
    else:
        print("NOT FOUND at all")

# Also add dynamic block options in filter bars
# Replace static block list with getFilteredBlocks
dynamic_opts = '{getFilteredBlocks(values.unit).map((b: string) => (\n              <option key={b}>{b}</option>\n            ))}'

# Find all block dropdowns (now static with 38 options) and make them dynamic
# Pattern: <option value="">全部区块</option>\n            <option>高18(南)</option>
marker = '<option value="">全部区块</option>'
idx = 0
replaced = 0
while True:
    idx = t.find(marker, idx)
    if idx == -1:
        break
    # Find after marker: check if followed by static options
    after_marker = idx + len(marker)
    # Find closing </select>
    end_select = t.find('</select>', after_marker)
    if end_select == -1:
        break
    section = t[after_marker:end_select]
    if '高18(南)' in section and 'getFilteredBlocks' not in section:
        t = t[:after_marker] + '\n            ' + dynamic_opts + '\n          ' + t[end_select:]
        replaced += 1
    idx = after_marker + 50

print(f"Dynamic blocks: {replaced} replaced")

# Fix onChange to reset block when unit changes  
old_onchange = 'unit: event.target.value })'
new_onchange = 'unit: event.target.value, block: "" })'
c4 = t.count(old_onchange)
t = t.replace(old_onchange, new_onchange)
print(f"onChange fixed: {c4}")

with open(r"C:\ZS\gszhushuiSQL\src\App.tsx", "w", encoding="utf-8") as f:
    f.write(t)

print("Done")