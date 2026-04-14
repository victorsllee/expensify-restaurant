import os
import re

DIR = os.path.expanduser('~/expensify-workspace/frontend/src/pages')

for filename in os.listdir(DIR):
    if filename.endswith('.tsx'):
        filepath = os.path.join(DIR, filename)
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Sizing updates for bottom navigation specifically
        content = re.sub(r'className="h-5 w-5"', r'className="h-6 w-6"', content)
        content = re.sub(r'size={20}', r'className="h-6 w-6"', content)
        content = re.sub(r'text-\[10px\]', r'text-[11px]', content)
        
        with open(filepath, 'w') as f:
            f.write(content)
print("Icons and text sizes updated!")