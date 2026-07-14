with open(r"C:\ZS\gszhushuiSQL\src\App.tsx", "r", encoding="utf-8") as f:
    t = f.read()

# ===== 1. Add BLOCK_UNIT_MAP and helper after subMenus declaration =====
block_unit_map_code = '''
  const BLOCK_UNIT_MAP: Record<string, string> = {
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
    return ALL_BLOCKS.filter((b) => BLOCK_UNIT_MAP[b] === unit);
  };
'''

# Insert after subMenus declaration
subMenus_marker = '{ id: "single-water" as const, label: "水井单井对比" },'
insert_pos = t.find(subMenus_marker)
if insert_pos > -1 and 'BLOCK_UNIT_MAP' not in t:
    insert_pos += len(subMenus_marker) + 1  # after newline
    t = t[:insert_pos] + '\n' + block_unit_map_code + t[insert_pos:]
    print("BLOCK_UNIT_MAP added")
else:
    print("BLOCK_UNIT_MAP skip (already present or marker not found)")

# ===== 2. Build the dynamic block options template =====
dynamic_block_options = '''{getFilteredBlocks(values.unit).map((b) => (
              <option key={b}>{b}</option>
            ))}'''

# ===== 3. Replace static block options in renderOverallFilterBar =====
# Find the static block option group and replace with dynamic version
# The pattern is: <option value="">全部区块</option>\n            <option>XXX</option>\n...38 blocks...
# Replace the entire 38-block list with the dynamic version

# Find the block group by looking for the pattern after 全部区块 option
marker_all_blocks = '<option value="">全部区块</option>'
# Static block list starts with the first block option after marker
static_start_pattern = '<option value="">全部区块</option>\\n            <option>高18(南)</option>'

# Actually, let me find and replace each filter bar's block section
# Strategy: find the marker and replace everything from there to the closing </select>

idx = 0
count_overall = 0
count_oil = 0
count_water = 0
replaced = 0

while True:
    idx = t.find(marker_all_blocks, idx)
    if idx == -1:
        break
    
    # Find the closing </select> after this marker
    end_select = t.find('</select>', idx)
    if end_select == -1:
        break
    
    # Find the next meaningful tag after </select>
    after_select = end_select + len('</select>')
    
    # Check if there are static block options between marker and </select>
    # (the current replacements already changed some parts)
    section = t[idx:end_select]
    
    if '高18(南)' in section or 'getFilteredBlocks' in section:
        if 'getFilteredBlocks' not in section:
            # Replace the static block list with dynamic version
            # Everything between the marker + \n and </select>
            marker_end = idx + len(marker_all_blocks)
            t = t[:marker_end] + '\n            ' + dynamic_block_options + '\n          ' + t[end_select:]
            replaced += 1
        idx = after_select + 200  # skip past the replacement
    else:
        idx = end_select + 1

print(f"Replaced {replaced} block dropdowns with dynamic version")

with open(r"C:\ZS\gszhushuiSQL\src\App.tsx", "w", encoding="utf-8") as f:
    f.write(t)
print("App.tsx updated")