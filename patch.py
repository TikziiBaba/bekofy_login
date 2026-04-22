import sys
with open('c:/Users/dedyu/Desktop/bekir/website/player.html', 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace('<div class="titlebar" id="titlebar">', '<div class="titlebar" id="titlebar" style="display:none">')
c = c.replace('<div class="app-layout">', '<div class="app-layout" style="height:calc(100vh - 90px);top:0">')
with open('c:/Users/dedyu/Desktop/bekir/website/player.html', 'w', encoding='utf-8') as f:
    f.write(c)
