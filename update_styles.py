import os
import re

DIR = os.path.expanduser('~/expensify-workspace/frontend/src/pages')

REPLACEMENTS = [
    # Buttons
    (r'bg-indigo-600 hover:bg-indigo-500 text-white', r'bg-zinc-900 text-zinc-50 hover:bg-zinc-900/90 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90'),
    (r'bg-indigo-600 text-white', r'bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900'),
    
    # Text
    (r'text-indigo-600\b', r'text-zinc-900 dark:text-zinc-50'),
    (r'text-indigo-800\b', r'text-zinc-800 dark:text-zinc-200'),
    (r'text-indigo-900\b', r'text-zinc-900 dark:text-zinc-100'),
    (r'text-indigo-300\b', r'text-zinc-300 dark:text-zinc-400'),
    (r'text-indigo-400\b', r'text-zinc-500 dark:text-zinc-400'),
    
    # Backgrounds
    (r'bg-indigo-50\b', r'bg-zinc-100 dark:bg-zinc-800/50'),
    (r'bg-indigo-100\b', r'bg-zinc-200 dark:bg-zinc-800'),
    (r'hover:bg-indigo-100\b', r'hover:bg-zinc-200 dark:hover:bg-zinc-800'),
    (r'dark:bg-indigo-900/20\b', r'dark:bg-zinc-800/50'),
    (r'dark:hover:bg-indigo-900/40\b', r'dark:hover:bg-zinc-800'),
    
    # Gradients
    (r'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20', r'bg-zinc-50 dark:bg-zinc-900/50'),
    
    # Borders & Rings
    (r'ring-indigo-200\b', r'ring-zinc-200 dark:ring-zinc-800'),
    (r'ring-indigo-600\b', r'ring-zinc-900 dark:ring-zinc-300'),
    (r'border-indigo-200\b', r'border-zinc-200 dark:border-zinc-700'),
    (r'border-indigo-100\b', r'border-zinc-200 dark:border-zinc-800'),
    (r'border-indigo-800/30\b', r'border-zinc-800'),
    (r'dark:border-indigo-800\b', r'dark:border-zinc-700'),
    (r'focus:border-indigo-500\b', r'focus:border-zinc-900 dark:focus:border-zinc-300'),
    (r'focus:ring-indigo-500\b', r'focus:ring-zinc-900 dark:focus:ring-zinc-300'),
    (r'focus:ring-indigo-600\b', r'focus:ring-zinc-900 dark:focus:ring-zinc-300'),
    
    # Rounding (shadcn is less rounded)
    (r'rounded-2xl\b', r'rounded-xl'),
    (r'rounded-xl\b', r'rounded-lg'),
    
    # Active/Hover states
    (r'hover:text-indigo-600\b', r'hover:text-zinc-900 dark:hover:text-zinc-50'),
    (r'dark:text-indigo-400\b', r'dark:text-zinc-400'),
    (r'hover:text-indigo-500\b', r'hover:text-zinc-700 dark:hover:text-zinc-300'),
    
    # Specific buttons
    (r'bg-green-600 hover:bg-green-500', r'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900'),
]

for filename in os.listdir(DIR):
    if filename.endswith('.tsx'):
        filepath = os.path.join(DIR, filename)
        with open(filepath, 'r') as f:
            content = f.read()
        
        for old, new in REPLACEMENTS:
            content = re.sub(old, new, content)
        
        with open(filepath, 'w') as f:
            f.write(content)
print("Styles updated!")