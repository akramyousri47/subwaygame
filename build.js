const fs = require('fs');

const path = require('path');
const THREE_PATH = path.join(__dirname, 'src', 'three.module.js');
const GAME_PATH = path.join(__dirname, 'src', 'game.js');
const OUT_PATH = path.join(__dirname, 'index.html');

const three = fs.readFileSync(THREE_PATH, 'utf8');
const game = fs.readFileSync(GAME_PATH, 'utf8');

const m = three.match(/export\s*\{([^}]*)\}\s*;?\s*$/);
if (!m) throw new Error('no trailing export statement found');

const pairs = m[1]
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .map(entry => {
    const p = entry.split(/\s+as\s+/);
    const local = p[0].trim();
    const exported = (p[1] || p[0]).trim();
    return exported + ':' + local;
  });

const vendored = three.slice(0, m.index) + '\nconst THREE = {' + pairs.join(',') + '};\nwindow.THREE = THREE;\n';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="author" content="Akram Yousri">
<meta name="copyright" content="© 2026 Akram Yousri">
<meta name="description" content="Subway Dash 3D — a browser endless runner. Created by Akram Yousri.">
<title>Subway Dash 3D</title>
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:#05070e;
    font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;
    -webkit-user-select:none;user-select:none;touch-action:none;color:#fff}
  canvas{display:block;width:100%;height:100%}
  #ui{position:fixed;inset:0;pointer-events:none;overflow:hidden}
  .hud{position:absolute;top:18px;left:20px;font-size:26px;font-weight:800;
    text-shadow:0 3px 10px rgba(0,0,0,.8);letter-spacing:.5px}
  .sub{position:absolute;top:50px;left:20px;font-size:15px;font-weight:700;opacity:.8;
    text-shadow:0 3px 10px rgba(0,0,0,.8)}
  .coins{position:absolute;top:18px;right:20px;font-size:26px;font-weight:800;color:#ffd23f;
    text-shadow:0 3px 10px rgba(0,0,0,.8)}
  .keys{position:absolute;bottom:30px;left:50%;transform:translateX(-50%);font-size:13px;
    opacity:.5;text-shadow:0 2px 8px #000;white-space:nowrap}
  .credit{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);font-size:11px;
    letter-spacing:.4px;color:#7f90ad;white-space:nowrap;text-shadow:0 2px 8px #000;opacity:.85}
  .credit b{color:#b9c8e0;font-weight:800;letter-spacing:.6px}
  .credit .dot{opacity:.5;margin:0 6px}
  .vign{position:absolute;inset:0;pointer-events:none;
    background:radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(0,0,0,.55) 100%)}
  .flash{position:absolute;inset:0;background:#ff3b30;opacity:0;pointer-events:none}
  .over{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;
    justify-content:center;background:radial-gradient(ellipse at center,rgba(8,10,22,.72),rgba(4,5,12,.93));
    pointer-events:auto;text-align:center;padding:20px;backdrop-filter:blur(3px)}
  .over.show{display:flex;animation:fade .35s ease}
  @keyframes fade{from{opacity:0}to{opacity:1}}
  .over h1{margin:0 0 12px;font-size:clamp(38px,10vw,72px);letter-spacing:2px;
    text-shadow:0 6px 30px rgba(0,0,0,.9)}
  .over p{margin:6px 0;font-size:20px;opacity:.92}
  .newbest{color:#ffd23f;font-weight:800}
  button{margin-top:24px;padding:16px 40px;font-size:22px;font-weight:800;border:0;
    border-radius:16px;background:#ffd23f;color:#241804;cursor:pointer;
    box-shadow:0 7px 0 #a8790f,0 12px 30px rgba(0,0,0,.5);transition:transform .08s}
  button:active{transform:translateY(4px);box-shadow:0 3px 0 #a8790f}
  #boot{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    font-size:18px;letter-spacing:2px;opacity:.7}
</style>
</head>
<body>
<div id="ui">
  <div class="hud">SCORE <span id="score">0</span></div>
  <div class="sub">BEST <span id="best">0</span></div>
  <div class="coins">COINS <span id="coins">0</span></div>
  <div class="keys">&#8592; &#8594; / A D switch lane &nbsp;&middot;&nbsp; &#8593; / W / Space jump &nbsp;&middot;&nbsp; &#8595; / S roll &nbsp;&middot;&nbsp; swipe on mobile</div>
  <div class="credit"><span>&copy; 2026</span><span class="dot">&middot;</span><span>Created by <b>Akram Yousri</b></span><span class="dot">&middot;</span><span>All rights reserved</span></div>
  <div class="vign"></div>
  <div class="flash" id="flash"></div>
  <div class="over" id="over">
    <h1>WIPED OUT</h1>
    <p>SCORE <span id="final">0</span></p>
    <p>DISTANCE <span id="dist">0</span> m &nbsp;·&nbsp; COINS <span id="c2">0</span></p>
    <p>BEST <span id="best2">0</span> <span class="newbest" id="nb"></span></p>
    <button id="again">Run Again</button>
  </div>
  <div id="boot">LOADING&hellip;</div>
</div>
<script type="module">
${vendored}
${game}
</script>
</body>
</html>
`;

fs.writeFileSync(OUT_PATH, html);
console.log('exports mapped:', pairs.length);
console.log('vendored bytes:', vendored.length);
console.log('out bytes:', html.length);
