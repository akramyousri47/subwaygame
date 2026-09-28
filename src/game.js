(function () {
  'use strict';
  var T = window.THREE;

  var LANE_X = [-1.7, 0, 1.7];
  var SPAWN_Z = -70;
  var DESPAWN_Z = 16;
  var HIP_Y = 0.88;
  var STAND_H = 1.72;
  var ROLL_H = 0.78;
  var GRAV = 21;
  var JUMP_V = 7.4;
  var TRAIN_LEN = 14;
  var PLAYER_HW = 0.34;

  var cvs, renderer, scene, camera, clock;
  var world, groundTex, wallTexA, wallTexB, sleepers, ribs, lamps, dust, dustArr;
  var human, P;
  var sun, lampA, lampB;
  var objs = [];
  var pool = { train: [], barrier: [], gantry: [], coin: [] };
  var best = 0;
  try { best = parseInt(localStorage.getItem('sd3d_best') || '0', 10) || 0; } catch (e) {}

  var scoreEl, coinsEl, bestEl, overEl, finalEl, best2El, nbEl, distEl, c2El, flashEl;

  var speed = 11, dist = 0, scoreDist = 0, coinCount = 0, elapsed = 0;
  var lane = 1, px = 0, jumpY = 0, jumpV = 0, rollT = 0, rollPhi = 0;
  var spawnGap = 14, prevFree = 1, state = 'play';
  var crashT = 0, shake = 0, animT = 0, camFov = 70, trainTone = 0;

  function mat(color, rough, metal, extra) {
    var o = { color: color, roughness: rough, metalness: metal };
    if (extra) for (var k in extra) o[k] = extra[k];
    return new T.MeshStandardMaterial(o);
  }

  function canvasTex(w, h, draw, rx, ry) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    if (rx) t.repeat.set(rx, ry);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function wrap(v, m) { return ((v % m) + m) % m; }

  var GEOM = null, MAT = null;

  function buildAssets() {
    GEOM = {
      trainShell: new T.BoxGeometry(1.5, 2.0, TRAIN_LEN),
      trainRoof: new T.BoxGeometry(1.54, 0.18, TRAIN_LEN + 0.04),
      trainSkirt: new T.BoxGeometry(1.34, 0.3, TRAIN_LEN - 0.6),
      trainBelt: new T.BoxGeometry(1.53, 0.1, TRAIN_LEN),
      trainWin: new T.BoxGeometry(0.04, 0.6, 1.6),
      trainFace: new T.BoxGeometry(1.16, 0.62, 0.05),
      wheel: new T.CylinderGeometry(0.3, 0.3, 0.15, 16),
      bulb: new T.SphereGeometry(0.08, 10, 8),
      barPost: new T.BoxGeometry(0.07, 1.05, 0.07),
      barFoot: new T.BoxGeometry(0.24, 0.06, 0.52),
      barBoard: new T.BoxGeometry(1.5, 0.3, 0.07),
      barStripe: new T.BoxGeometry(0.44, 0.3, 0.08),
      barLamp: new T.SphereGeometry(0.06, 8, 6),
      ganPost: new T.CylinderGeometry(0.08, 0.09, 1.5, 12),
      ganFoot: new T.BoxGeometry(0.28, 0.08, 0.28),
      ganPipe: new T.CylinderGeometry(0.12, 0.12, 1.5, 14),
      ganBand: new T.CylinderGeometry(0.125, 0.125, 0.18, 14),
      ganSign: new T.BoxGeometry(0.55, 0.24, 0.05),
      coin: new T.TorusGeometry(0.17, 0.055, 10, 22)
    };
    MAT = {
      roof: mat(0x9aa3b2, 0.35, 0.7),
      skirt: mat(0x14161c, 0.55, 0.5),
      glass: mat(0x0b1622, 0.05, 1.0, { envMapIntensity: 2.0 }),
      trim: mat(0xf2c14b, 0.4, 0.3),
      steel: mat(0x9aa0ac, 0.4, 0.7),
      board: mat(0xf07a1f, 0.7, 0.05),
      white: mat(0xeef0f4, 0.65, 0.05),
      haz: mat(0xf0c419, 0.6, 0.2),
      sign: mat(0x22252e, 0.6, 0.3),
      bulbWarm: new T.MeshBasicMaterial({ color: 0xfff6d8 }),
      bulbAmber: new T.MeshBasicMaterial({ color: 0xff9a1f }),
      bulbRed: new T.MeshBasicMaterial({ color: 0xff3b30 }),
      lamp: new T.MeshBasicMaterial({ color: 0xfff2d0 }),
      wheel: mat(0x2a2d35, 0.5, 0.8),
      coin: new T.MeshStandardMaterial({
        color: 0xffc22e, metalness: 0.95, roughness: 0.18,
        emissive: 0x5a3a00, emissiveIntensity: 0.55
      }),
      trainBody: [
        mat(0x2f5fb0, 0.4, 0.45), mat(0xb03a3a, 0.4, 0.45),
        mat(0x2f8f5f, 0.4, 0.45), mat(0xc07a20, 0.4, 0.45),
        mat(0x6a4bb0, 0.4, 0.45), mat(0x2b7f8f, 0.4, 0.45)
      ]
    };
  }

  function init() {
    buildAssets();
    cvs = document.createElement('canvas');
    document.body.insertBefore(cvs, document.getElementById('ui'));

    renderer = new T.WebGLRenderer({ canvas: cvs, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    scene = new T.Scene();
    scene.background = new T.Color(0x070a12);
    scene.fog = new T.Fog(0x0a0e1a, 14, 88);

    camera = new T.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 220);
    camera.position.set(0, 2.45, 6.6);

    buildEnvironment();
    buildLighting();

    human = buildHuman();
    P = human;
    scene.add(human.root);

    scoreEl = document.getElementById('score');
    coinsEl = document.getElementById('coins');
    bestEl = document.getElementById('best');
    overEl = document.getElementById('over');
    finalEl = document.getElementById('final');
    best2El = document.getElementById('best2');
    nbEl = document.getElementById('nb');
    distEl = document.getElementById('dist');
    c2El = document.getElementById('c2');
    flashEl = document.getElementById('flash');
    bestEl.textContent = best;
    var boot = document.getElementById('boot');
    if (boot) boot.remove();

    window.addEventListener('resize', onResize);
    bindInput();
    start();
    clock = new T.Clock();
    renderer.setAnimationLoop(frame);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  function buildEnvironment() {
    var pmrem = new T.PMREMGenerator(renderer);
    var envScene = new T.Scene();
    var grad = canvasTex(8, 64, function (g, w, h) {
      var lg = g.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, '#ffffff');
      lg.addColorStop(0.28, '#c8d6f2');
      lg.addColorStop(0.5, '#3a4661');
      lg.addColorStop(1, '#080a10');
      g.fillStyle = lg; g.fillRect(0, 0, w, h);
    });
    envScene.add(new T.Mesh(new T.BoxGeometry(30, 30, 30),
      new T.MeshBasicMaterial({ map: grad, side: T.BackSide })));
    var strip = new T.MeshBasicMaterial({ color: 0xffffff });
    for (var i = -1; i <= 1; i++) {
      var q = new T.Mesh(new T.PlaneGeometry(3.4, 24), strip);
      q.position.set(i * 7, 9, 0);
      q.rotation.x = Math.PI / 2;
      envScene.add(q);
    }
    scene.environment = pmrem.fromScene(envScene, 0.03).texture;
    if ('environmentIntensity' in scene) scene.environmentIntensity = 0.5;
    pmrem.dispose();

    world = new T.Group();
    scene.add(world);

    groundTex = canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#22242e'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 5200; i++) {
        var s = 1 + Math.random() * 2.6;
        var v = 24 + Math.random() * 46;
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 6) + ',' + (0.25 + Math.random() * 0.5) + ')';
        g.fillRect(Math.random() * w, Math.random() * h, s, s);
      }
      g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 3;
      for (var y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    }, 5, 32);
    var ground = new T.Mesh(new T.PlaneGeometry(60, 200),
      mat(0xffffff, 0.95, 0.02, { map: groundTex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -80);
    ground.receiveShadow = true;
    world.add(ground);

    function wallTex() {
      return canvasTex(128, 128, function (g, w, h) {
        g.fillStyle = '#2b2f3c'; g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 2;
        for (var y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        for (var x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      }, 7, 3);
    }
    wallTexA = wallTex(); wallTexB = wallTex();
    [-1, 1].forEach(function (s) {
      var wall = new T.Mesh(new T.PlaneGeometry(200, 6),
        mat(0xffffff, 0.88, 0.05, { map: s < 0 ? wallTexA : wallTexB }));
      wall.position.set(s * 5.6, 3, -80);
      wall.rotation.y = -s * Math.PI / 2;
      world.add(wall);
    });

    var ceil = new T.Mesh(new T.PlaneGeometry(14, 200), mat(0x14161f, 0.95, 0.02));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 6, -80);
    world.add(ceil);

    var railMat = mat(0x8b93a3, 0.28, 0.92);
    [-0.72, 0.72].forEach(function (x) {
      [-2.6, 2.6].forEach(function (z) {
        var r = new T.Mesh(new T.BoxGeometry(0.12, 0.16, 200), railMat);
        r.position.set(x, 0.11, z - 80);
        r.receiveShadow = true;
        world.add(r);
      });
    });

    var dummy = new T.Object3D();
    sleepers = new T.InstancedMesh(new T.BoxGeometry(3.3, 0.16, 0.5),
      mat(0x2a2318, 0.95, 0.03), 60);
    sleepers.receiveShadow = true;
    for (i = 0; i < 60; i++) {
      dummy.position.set(0, 0.07, -i * 2.4);
      dummy.updateMatrix();
      sleepers.setMatrixAt(i, dummy.matrix);
    }
    sleepers.instanceMatrix.needsUpdate = true;
    world.add(sleepers);

    var ribGroup = new T.Group();
    var ribMat = mat(0x343a4a, 0.85, 0.1);
    for (i = 0; i < 25; i++) {
      var z = -i * 6;
      [-1, 1].forEach(function (s) {
        var post = new T.Mesh(new T.BoxGeometry(0.32, 5.7, 0.46), ribMat);
        post.position.set(s * 5.32, 2.85, z);
        post.castShadow = true; post.receiveShadow = true;
        ribGroup.add(post);
      });
      var beam = new T.Mesh(new T.BoxGeometry(11.3, 0.42, 0.46), ribMat);
      beam.position.set(0, 5.6, z);
      beam.castShadow = true;
      ribGroup.add(beam);
    }
    world.add(ribGroup);
    ribs = ribGroup;

    var lampGroup = new T.Group();
    for (i = 0; i < 12; i++) {
      var lamp = new T.Mesh(new T.BoxGeometry(1.5, 0.12, 0.3), MAT.lamp);
      lamp.position.set(i % 2 ? 1.7 : -1.7, 5.3, -i * 12.5);
      lampGroup.add(lamp);
    }
    world.add(lampGroup);
    lamps = lampGroup;

    var n = 220;
    var pos = new Float32Array(n * 3);
    for (i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 11;
      pos[i * 3 + 1] = Math.random() * 5 + 0.2;
      pos[i * 3 + 2] = -Math.random() * 80 + 8;
    }
    var dg = new T.BufferGeometry();
    dg.setAttribute('position', new T.BufferAttribute(pos, 3));
    var dot = canvasTex(32, 32, function (g, w) {
      var rg = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      rg.addColorStop(0, 'rgba(255,255,255,1)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.fillRect(0, 0, w, w);
    });
    dustArr = pos;
    dust = new T.Points(dg, new T.PointsMaterial({
      size: 0.07, map: dot, transparent: true, opacity: 0.4,
      depthWrite: false, color: 0xdfe8ff
    }));
    world.add(dust);
  }

  function buildLighting() {
    scene.add(new T.HemisphereLight(0x9fb4e0, 0x2b2418, 0.55));
    sun = new T.DirectionalLight(0xfff1dd, 1.8);
    sun.position.set(7, 15, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -13;
    sun.shadow.camera.right = 13;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -6;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.0009;
    sun.shadow.normalBias = 0.022;
    sun.target.position.set(0, 0.6, -8);
    scene.add(sun, sun.target);
    lampA = new T.PointLight(0xffd9a0, 30, 24, 2);
    lampB = new T.PointLight(0xffd9a0, 24, 22, 2);
    scene.add(lampA, lampB);
  }

  function pivot(parent, x, y, z) {
    var g = new T.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }
  function addMesh(parent, geo, matl, x, y, z, rot) {
    var m = new T.Mesh(geo, matl);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function cap(parent, r, len, matl, x, y, z, seg) {
    return addMesh(parent, new T.CapsuleGeometry(r, len, 4, seg || 12), matl, x, y, z);
  }

  function buildHuman() {
    var skin = mat(0xdfa97c, 0.66, 0.02);
    var shirt = mat(0x1d3f6b, 0.9, 0.02);
    var shirt2 = mat(0x16304f, 0.9, 0.02);
    var pants = mat(0x2c3550, 0.92, 0.02);
    var shoe = mat(0x15171d, 0.55, 0.05);
    var sole = mat(0xf0f0f0, 0.7, 0.02);
    var hair = mat(0x1c1310, 0.55, 0.05);
    var bag = mat(0xc33b2e, 0.78, 0.05);
    var bag2 = mat(0x9c2c22, 0.8, 0.05);
    var eye = mat(0x14161c, 0.25, 0.1);
    var teeth = mat(0xf3f3f3, 0.4, 0.05);

    var root = new T.Group();
    var body = pivot(root, 0, 0, 0);
    var hips = pivot(body, 0, HIP_Y, 0);
    cap(hips, 0.15, 0.1, pants, 0, -0.02, 0, 14);

    var spine = pivot(hips, 0, 0.09, 0);
    cap(spine, 0.135, 0.12, shirt, 0, 0.1, 0, 14);

    var chest = pivot(spine, 0, 0.24, 0);
    cap(chest, 0.175, 0.2, shirt, 0, 0.1, 0, 16);
    addMesh(chest, new T.BoxGeometry(0.3, 0.2, 0.02), shirt2, 0, 0.02, -0.175);
    addMesh(chest, new T.BoxGeometry(0.3, 0.36, 0.17), bag, 0, 0.1, 0.2);
    addMesh(chest, new T.BoxGeometry(0.29, 0.09, 0.19), bag2, 0, 0.24, 0.2);
    [-0.12, 0.12].forEach(function (x) {
      addMesh(chest, new T.BoxGeometry(0.05, 0.34, 0.04), bag, x, 0.16, 0.09);
    });

    var neck = pivot(chest, 0, 0.26, 0);
    cap(neck, 0.052, 0.05, skin, 0, 0.02, 0, 10);

    var head = pivot(neck, 0, 0.1, 0);
    var skull = addMesh(head, new T.SphereGeometry(0.115, 22, 18), skin, 0, 0, 0);
    skull.scale.set(1, 1.12, 1.02);
    var hairMesh = new T.Mesh(
      new T.SphereGeometry(0.122, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
    hairMesh.position.set(0, 0.012, 0.012);
    hairMesh.castShadow = true;
    head.add(hairMesh);
    var hood = new T.Mesh(
      new T.SphereGeometry(0.135, 18, 14, 0, Math.PI, 0, Math.PI * 0.62), shirt2);
    hood.position.set(0, -0.02, 0.04);
    hood.rotation.y = Math.PI / 2;
    hood.castShadow = true;
    head.add(hood);
    [-0.045, 0.045].forEach(function (x) {
      addMesh(head, new T.SphereGeometry(0.016, 10, 8), eye, x, 0.012, -0.104);
    });
    var nose = addMesh(head, new T.SphereGeometry(0.022, 8, 6), skin, 0, -0.022, -0.112);
    nose.scale.set(0.8, 1, 1.1);
    addMesh(head, new T.BoxGeometry(0.05, 0.008, 0.01), teeth, 0, -0.058, -0.104);
    [-0.05, 0.05].forEach(function (x) {
      addMesh(head, new T.BoxGeometry(0.045, 0.01, 0.01), hair, x, 0.042, -0.105,
        [0, 0, x > 0 ? -0.12 : 0.12]);
    });

    var R = { shL: null, elL: null, shR: null, elR: null, thL: null, knL: null, thR: null, knR: null };
    [-1, 1].forEach(function (s) {
      var k = s < 0 ? 'L' : 'R';
      var sh = pivot(chest, s * 0.185, 0.19, 0);
      cap(sh, 0.062, 0.2, shirt, 0, -0.13, 0, 10);
      var el = pivot(sh, 0, -0.28, 0);
      cap(el, 0.05, 0.18, skin, 0, -0.11, 0, 10);
      cap(el, 0.045, 0.03, skin, 0, -0.27, 0, 10);
      R['sh' + k] = sh; R['el' + k] = el;
    });

    [-1, 1].forEach(function (s) {
      var k = s < 0 ? 'L' : 'R';
      var th = pivot(hips, s * 0.095, -0.12, 0);
      cap(th, 0.078, 0.24, pants, 0, -0.17, 0, 10);
      var kn = pivot(th, 0, -0.42, 0);
      cap(kn, 0.062, 0.24, pants, 0, -0.17, 0, 10);
      var an = pivot(kn, 0, -0.42, 0);
      addMesh(an, new T.BoxGeometry(0.105, 0.08, 0.26), shoe, 0, -0.03, -0.06);
      addMesh(an, new T.BoxGeometry(0.11, 0.03, 0.28), sole, 0, -0.068, -0.06);
      R['th' + k] = th; R['kn' + k] = kn;
    });

    root.traverse(function (o) { if (o.isMesh) o.castShadow = true; });

    return {
      root: root, body: body, hips: hips, chest: chest, head: head,
      shL: R.shL, elL: R.elL, shR: R.shR, elR: R.elR,
      thL: R.thL, knL: R.knL, thR: R.thR, knR: R.knR
    };
  }

  function buildTrain() {
    var g = new T.Group();
    var body = addMesh(g, GEOM.trainShell, MAT.trainBody[0], 0, 1.55, 0);
    addMesh(g, GEOM.trainRoof, MAT.roof, 0, 2.64, 0);
    addMesh(g, GEOM.trainSkirt, MAT.skirt, 0, 0.33, 0);
    addMesh(g, GEOM.trainBelt, MAT.trim, 0, 1.1, 0);
    var L = TRAIN_LEN, H = L / 2;
    [-1, 1].forEach(function (s) {
      for (var i = 0; i < 5; i++) {
        addMesh(g, GEOM.trainWin, MAT.glass, s * 0.77, 1.8, -H + 1.6 + i * 2.4);
      }
    });
    addMesh(g, GEOM.trainFace, MAT.glass, 0, 1.9, H + 0.01);
    addMesh(g, GEOM.trainBelt, MAT.trim, 0, 1.45, H + 0.01);
    [-0.44, 0.44].forEach(function (x) {
      addMesh(g, GEOM.bulb, MAT.bulbWarm, x, 0.87, H + 0.05);
    });
    addMesh(g, GEOM.bulb, MAT.bulbRed, 0, 2.65, H - 0.2);
    [-1, 1].forEach(function (z) {
      [-1, 1].forEach(function (s) {
        addMesh(g, GEOM.wheel, MAT.wheel, s * 0.63, 0.3, z * (H - 2.2), [0, 0, Math.PI / 2]);
        addMesh(g, GEOM.wheel, MAT.wheel, s * 0.63, 0.3, z * (H - 2.2) + z * 2.2, [0, 0, Math.PI / 2]);
      });
    });
    g.userData.body = body;
    return g;
  }

  function buildBarrier() {
    var g = new T.Group();
    [-0.62, 0.62].forEach(function (x) {
      addMesh(g, GEOM.barPost, MAT.steel, x, 0.52, 0);
      addMesh(g, GEOM.barFoot, MAT.steel, x, 0.03, 0);
    });
    addMesh(g, GEOM.barBoard, MAT.board, 0, 0.95, 0);
    addMesh(g, GEOM.barStripe, MAT.white, -0.5, 0.95, 0);
    addMesh(g, GEOM.barStripe, MAT.white, 0.5, 0.95, 0);
    addMesh(g, GEOM.barLamp, MAT.bulbAmber, 0, 1.16, 0);
    return g;
  }

  function buildGantry() {
    var g = new T.Group();
    [-0.66, 0.66].forEach(function (x) {
      addMesh(g, GEOM.ganPost, MAT.steel, x, 0.75, 0);
      addMesh(g, GEOM.ganFoot, MAT.skirt, x, 0.04, 0);
    });
    addMesh(g, GEOM.ganPipe, MAT.haz, 0, 1.45, 0, [0, 0, Math.PI / 2]);
    for (var i = -1; i <= 1; i++) {
      addMesh(g, GEOM.ganBand, MAT.skirt, i * 0.5, 1.45, 0, [0, 0, Math.PI / 2]);
    }
    addMesh(g, GEOM.ganSign, MAT.sign, 0, 1.74, 0);
    return g;
  }

  function acquire(kind, builder) {
    var p = pool[kind];
    var n = p.length ? p.pop() : builder();
    n.visible = true;
    scene.add(n);
    return n;
  }
  function release(kind, n) {
    n.visible = false;
    scene.remove(n);
    pool[kind].push(n);
  }

  function spawnRow() {
    var step = Math.random() < 0.34 ? 0 : (Math.random() < 0.5 ? -1 : 1);
    var free = clamp(prevFree + step, 0, 2);
    prevFree = free;

    for (var i = 0; i < 3; i++) {
      if (i === free) continue;
      var x = LANE_X[i], r = Math.random();
      if (r < 0.28) {
        var t = acquire('train', buildTrain);
        t.userData.body.material = MAT.trainBody[trainTone++ % MAT.trainBody.length];
        t.position.set(x, 0, SPAWN_Z);
        objs.push({ type: 'train', node: t, x: x, hw: 0.76, ymin: 0, ymax: 2.72, len: TRAIN_LEN, z: SPAWN_Z });
      } else if (r < 0.68) {
        var b = acquire('barrier', buildBarrier);
        b.position.set(x, 0, SPAWN_Z);
        objs.push({ type: 'barrier', node: b, x: x, hw: 0.72, ymin: 0, ymax: 1.12, len: 0.4, z: SPAWN_Z });
      } else {
        var gy = acquire('gantry', buildGantry);
        gy.position.set(x, 0, SPAWN_Z);
        objs.push({ type: 'gantry', node: gy, x: x, hw: 0.72, ymin: 1.42, ymax: 2.4, len: 0.4, z: SPAWN_Z });
      }
    }

    if (Math.random() < 0.7) {
      var n = 4 + ((Math.random() * 4) | 0);
      for (var k = 0; k < n; k++) {
        var c = acquire('coin', function () { return new T.Mesh(GEOM.coin, MAT.coin); });
        var cz = SPAWN_Z - 3 - k * 1.7;
        c.position.set(LANE_X[free], 1.0, cz);
        objs.push({
          type: 'coin', node: c, x: LANE_X[free], hw: 0.42,
          y: 1.0, len: 0.2, z: cz, phase: Math.random() * 6.28
        });
      }
    }
  }

  function clearObjs() {
    for (var i = 0; i < objs.length; i++) release(objs[i].type, objs[i].node);
    objs.length = 0;
  }

  function start() {
    clearObjs();
    speed = 11; dist = 0; scoreDist = 0; coinCount = 0; elapsed = 0;
    lane = 1; px = 0; jumpY = 0; jumpV = 0; rollT = 0; rollPhi = 0;
    spawnGap = 10; prevFree = 1; state = 'play'; crashT = 0; shake = 0;
    camera.position.set(0, 2.45, 6.6);
    sleepers.position.z = 0; ribs.position.z = 0; lamps.position.z = 0;
    human.root.position.set(0, 0, 0);
    human.root.rotation.set(0, 0, 0);
    human.body.position.set(0, 0, 0);
    human.body.rotation.set(0, 0, 0);
    human.hips.position.y = HIP_Y;
    overEl.className = 'over';
    flashEl.style.opacity = '0';
    updateHud();
  }

  function crash() {
    if (state !== 'play') return;
    state = 'over';
    crashT = 0;
    shake = 1;
    var s = Math.floor(scoreDist + coinCount * 10);
    var isNew = s > best;
    if (isNew) {
      best = s;
      try { localStorage.setItem('sd3d_best', String(best)); } catch (e) {}
    }
    bestEl.textContent = best;
    finalEl.textContent = s;
    best2El.textContent = best;
    distEl.textContent = Math.floor(dist);
    c2El.textContent = coinCount;
    nbEl.textContent = isNew ? '&#9733; NEW BEST!' : '';
    overEl.className = 'over show';
  }

  function updateHud() {
    scoreEl.textContent = Math.floor(scoreDist + coinCount * 10);
    coinsEl.textContent = coinCount;
  }

  function move(d) {
    if (state !== 'play') return;
    lane = clamp(lane + d, 0, 2);
  }
  function jump() {
    if (state !== 'play' || jumpY > 0 || jumpV > 0 || rollT > 0) return;
    jumpV = JUMP_V;
  }
  function roll() {
    if (state !== 'play' || rollT > 0) return;
    rollT = 0.62;
    if (jumpV > 0) { jumpY = 0; jumpV = -9; }
  }

  function applyPose(t, k) {
    P.thL.rotation.x += (t.thL - P.thL.rotation.x) * k;
    P.thR.rotation.x += (t.thR - P.thR.rotation.x) * k;
    P.knL.rotation.x += (t.knL - P.knL.rotation.x) * k;
    P.knR.rotation.x += (t.knR - P.knR.rotation.x) * k;
    P.shL.rotation.x += (t.shL - P.shL.rotation.x) * k;
    P.shR.rotation.x += (t.shR - P.shR.rotation.x) * k;
    P.elL.rotation.x += (t.elL - P.elL.rotation.x) * k;
    P.elR.rotation.x += (t.elR - P.elR.rotation.x) * k;
    P.chest.rotation.x += (t.chestX - P.chest.rotation.x) * k;
    P.chest.rotation.y += (t.chestY - P.chest.rotation.y) * k;
    P.chest.rotation.z += (t.chestZ - P.chest.rotation.z) * k;
    P.head.rotation.x += (t.headX - P.head.rotation.x) * k;
    P.hips.position.y += (t.hipY - P.hips.position.y) * k;
    P.body.rotation.x += (t.bodyX - P.body.rotation.x) * k;
    P.body.position.y += (t.bodyY - P.body.position.y) * k;
  }

  function updateHuman(dt) {
    var k = 1 - Math.exp(-16 * dt);
    var t = {};
    var ph = animT * 8.2;
    var s = Math.sin(ph);

    if (state === 'play' && rollT > 0) {
      t.thL = 1.75; t.thR = 1.65; t.knL = -2.05; t.knR = -2.05;
      t.shL = 1.5; t.shR = 1.3; t.elL = -1.9; t.elR = -1.9;
      t.hipY = 0.5; t.chestX = 0.72; t.chestY = 0; t.chestZ = 0;
      t.headX = 0.38; t.bodyX = -rollPhi; t.bodyY = 0.6;
    } else if (state === 'play' && (jumpY > 0 || jumpV > 0)) {
      var a = clamp(1 - jumpY / 1.3, 0, 1);
      t.thL = -0.95 * a - 0.12; t.thR = -0.35 * a - 0.12;
      t.knL = 1.4 * a; t.knR = 0.75 * a;
      t.shL = 1.5 * a; t.shR = 0.85 * a;
      t.elL = -0.7 * a - 0.35; t.elR = -1.0 * a - 0.35;
      t.hipY = HIP_Y + jumpY * 0.04;
      t.chestX = 0.1 - a * 0.12; t.chestY = 0; t.chestZ = 0;
      t.headX = -0.05 - a * 0.1; t.bodyX = 0; t.bodyY = 0;
    } else if (state === 'play') {
      t.thL = s * 1.0 - 0.05; t.thR = -s * 1.0 - 0.05;
      t.knL = -Math.max(0, Math.sin(ph + 0.85)) * 1.65;
      t.knR = -Math.max(0, Math.sin(ph + 0.85 + Math.PI)) * 1.65;
      t.shL = -s * 0.95; t.shR = s * 0.95;
      t.elL = -0.5 - Math.max(0, -s); t.elR = -0.5 - Math.max(0, s);
      t.hipY = HIP_Y + Math.abs(s) * 0.055;
      t.chestX = 0.17 + s * 0.035;
      t.chestY = s * 0.09; t.chestZ = -s * 0.03;
      t.headX = -0.11; t.bodyX = 0; t.bodyY = 0;
    } else {
      t.thL = 0.25; t.thR = -0.35; t.knL = -0.7; t.knR = -1.0;
      t.shL = 0.95; t.shR = -0.55; t.elL = -0.3; t.elR = -0.65;
      t.hipY = 0.4; t.chestX = 0.3; t.chestY = 0.15; t.chestZ = 0.2;
      t.headX = 0.45; t.bodyX = -1.15; t.bodyY = 0.45;
    }

    applyPose(t, k);
    P.shL.rotation.z = 0.17;
    P.shR.rotation.z = -0.17;
    P.thL.rotation.z = 0.03;
    P.thR.rotation.z = -0.03;
    if (state === 'over') {
      P.body.rotation.z += (1.1 - P.body.rotation.z) * (1 - Math.exp(-4 * dt));
    }
  }

  function updateObstacles(dt, step) {
    var ph = rollT > 0 ? ROLL_H : STAND_H;
    var hit = false;
    var alive = [];
    for (var i = 0; i < objs.length; i++) {
      var o = objs[i];
      o.z += step;
      o.node.position.z = o.z;
      if (o.z > DESPAWN_Z) { release(o.type, o.node); continue; }

      if (o.type === 'coin') {
        o.node.rotation.y += dt * 4.4;
        o.node.position.y = o.y + Math.sin(animT * 3 + o.phase) * 0.07;
        if (Math.abs(o.x - px) < o.hw + PLAYER_HW && o.z > -1.2 && o.z < 1.0) {
          release(o.type, o.node);
          coinCount++;
          continue;
        }
      } else if (!hit && Math.abs(o.x - px) < o.hw + PLAYER_HW &&
        o.z > -0.8 && o.z - o.len < 0.8) {
        if (jumpY < o.ymax - 0.05 && jumpY + ph > o.ymin + 0.05) hit = true;
      }
      alive.push(o);
    }
    objs = alive;
    if (hit) crash();
  }

  function update(dt) {
    animT += dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 1.6);

    if (state === 'play') {
      elapsed += dt;
      speed = Math.min(26, 11 + elapsed * 0.2);
      var step = speed * dt;
      dist += step;
      scoreDist += step;

      spawnGap -= step;
      if (spawnGap <= 0) {
        spawnRow();
        spawnGap = 20 - Math.min(5, elapsed * 0.05) + Math.random() * 8;
      }

      px += (LANE_X[lane] - px) * (1 - Math.exp(-13 * dt));

      if (jumpY > 0 || jumpV > 0) {
        jumpV -= GRAV * dt;
        jumpY += jumpV * dt;
        if (jumpY <= 0) { jumpY = 0; jumpV = 0; }
      }
      if (rollT > 0) {
        rollT -= dt;
        rollPhi = (1 - clamp(rollT / 0.62, 0, 1)) * Math.PI * 2;
        if (rollT <= 0) rollPhi = 0;
      }

      updateObstacles(dt, step);
      updateHud();
    } else if (state === 'over') {
      crashT += dt;
      for (var i = 0; i < objs.length; i++) objs[i].node.position.z = objs[i].z;
      human.root.position.z += speed * dt * 0.4;
      flashEl.style.opacity = String(Math.max(0, 0.5 - crashT * 2.2));
    }

    updateHuman(dt);
    human.root.position.x = px;
    human.root.position.y = jumpY;

    sleepers.position.z = wrap(dist, 2.4);
    ribs.position.z = wrap(dist, 6);
    lamps.position.z = wrap(dist, 12.5);
    groundTex.offset.y = -wrap(dist, 200) / 200 * 32;
    wallTexA.offset.x = -wrap(dist, 200) / 200 * 7;
    wallTexB.offset.x = wrap(dist, 200) / 200 * 7;

    for (var d = 0; d < dustArr.length; d += 3) {
      var z = dustArr[d + 2] + speed * dt * 1.15;
      if (z > 10) {
        z = -78 - Math.random() * 20;
        dustArr[d] = (Math.random() - 0.5) * 11;
        dustArr[d + 1] = Math.random() * 5 + 0.2;
      }
      dustArr[d + 2] = z;
    }
    dust.geometry.attributes.position.needsUpdate = true;

    var tf = 70 + (speed - 11) * 0.45;
    if (Math.abs(tf - camFov) > 0.05) {
      camFov += (tf - camFov) * (1 - Math.exp(-3 * dt));
      camera.fov = camFov;
      camera.updateProjectionMatrix();
    }

    var bob = (state === 'play' && jumpY <= 0 && rollT <= 0)
      ? Math.abs(Math.sin(animT * 8.2)) * 0.055 : 0;
    var camY = 2.45 + bob + jumpY * 0.35;
    var camX = px * 0.42;
    var camZ = 6.6;
    if (state === 'over') {
      var t2 = Math.min(1, crashT / 1.3);
      camX = px * 0.42 + Math.sin(t2 * 1.3) * 2.2 * t2;
      camY = 2.45 - t2 * 0.7;
      camZ = 6.6 + t2 * 2.4;
    }
    var ks = 1 - Math.exp(-(state === 'over' ? 3 : 9) * dt);
    camera.position.x += (camX - camera.position.x) * ks;
    camera.position.y += (camY - camera.position.y) * ks;
    camera.position.z += (camZ - camera.position.z) * ks;
    var sh = shake * shake * 0.14;
    camera.position.x += (Math.random() - 0.5) * sh;
    camera.position.y += (Math.random() - 0.5) * sh;
    camera.lookAt(px * 0.55, 1.55 + jumpY * 0.4, -9);

    lampA.position.set(0, 4.6, -2.5);
    lampB.position.set(0, 4.6, -15);
  }

  function frame() {
    var dt = Math.min(clock.getDelta(), 0.05);
    update(dt);
    renderer.render(scene, camera);
  }

  function bindInput() {
    window.addEventListener('keydown', function (e) {
      var k = e.key.toLowerCase();
      if (k === ' ' || k.indexOf('arrow') === 0) e.preventDefault();
      if (state === 'over') {
        if (k === ' ' || k === 'enter' || k === 'r') start();
        return;
      }
      if (k === 'arrowleft' || k === 'a') move(-1);
      else if (k === 'arrowright' || k === 'd') move(1);
      else if (k === 'arrowup' || k === 'w' || k === ' ') jump();
      else if (k === 'arrowdown' || k === 's') roll();
    });

    var sx = 0, sy = 0, sw = false;
    cvs.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; sw = true; });
    cvs.addEventListener('pointerup', function (e) {
      if (!sw) return;
      sw = false;
      if (state === 'over') { start(); return; }
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
      else if (dy < -28) jump();
      else if (dy > 28) roll();
    });
    cvs.addEventListener('pointercancel', function () { sw = false; });
    document.getElementById('again').addEventListener('click', function (e) {
      e.stopPropagation();
      start();
    });
  }

  window.addEventListener('error', function (e) {
    var b = document.getElementById('boot');
    if (b) b.textContent = 'ERROR: ' + e.message;
  });

  if (T) init();
  else {
    var b = document.getElementById('boot');
    if (b) b.textContent = 'THREE FAILED TO LOAD';
  }
})();
