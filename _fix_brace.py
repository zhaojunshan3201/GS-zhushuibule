t = open(r"C:\ZS\gszhushuiSQL\src\App.tsx", "r", encoding="utf-8").read()
# The subMenus last item ends with },  
# Then blank lines, then const groupHeaders
# Find and fix
old = '"水井单井对比" },\n\n\nconst groupHeaders'
new = '"水井单井对比" },\n  ];\n\nconst groupHeaders'
if old in t:
    t = t.replace(old, new)
    print("FIXED")
else:
    # Try with \r\n
    old2 = '"水井单井对比" },\r\n\r\n\r\nconst groupHeaders'
    new2 = '"水井单井对比" },\r\n  ];\r\n\r\nconst groupHeaders'
    if old2 in t:
        t = t.replace(old2, new2)
        print("FIXED (crlf)")
    else:
        print("NOT FOUND")
        # Show what's there
        import re
        m = re.search(r'水井单井对比.{0,30}const groupHeaders', t, re.DOTALL)
        if m:
            print("found:", repr(m.group()[:80]))
open(r"C:\ZS\gszhushuiSQL\src\App.tsx", "w", encoding="utf-8").write(t)