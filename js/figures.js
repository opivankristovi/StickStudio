/* StickStudio – parametric stick figure engine.
 * Every figure = character (costume + proportions) × pose (joint angles) × expression × effects.
 * Angles are absolute, in degrees: 0 = straight down, 90 = forward (+x), -90 = backward, 180 = up.
 * Figures are drawn facing right; flipping is done by the item transform.
 */
(function () {
  const NW = 120, NH = 220;           // native box
  const GROUND = 212;                 // ground line inside native box
  const PAPER = '#ffffff';

  const PROPORTIONS = {
    adult: { torso: 52, neck: 7, upper: 29, lower: 28, thigh: 38, shin: 38, head: 17 },
    kid:   { torso: 40, neck: 6, upper: 23, lower: 22, thigh: 29, shin: 29, head: 18 }
  };

  // ---------------------------------------------------------------- poses
  // la/ra = left/right arm [upper, forearm], ll/rl = legs [thigh, shin]
  const POSES = {
    stand:    { name: 'Stand',        view: 'front', la: [-14, -8],  ra: [14, 8],    ll: [-9, -5],  rl: [9, 5] },
    hips:     { name: 'Hands on hips',view: 'front', la: [-55, 35],  ra: [55, -35],  ll: [-11, -6], rl: [11, 6] },
    walk:     { name: 'Walk',         view: 'side', lean: 4, la: [-28, -12], ra: [28, 45], ll: [-22, -12], rl: [24, 6] },
    run:      { name: 'Run',          view: 'side', lean: 18, la: [-55, -110], ra: [55, 140], ll: [-35, -85], rl: [75, 10], fxAuto: ['speed'] },
    panic:    { name: 'Panic run',    view: 'side', lean: 14, la: [150, 175], ra: [-150, -175], ll: [-35, -85], rl: [70, 5] },
    jump:     { name: 'Jump for joy', view: 'front', la: [-140, -165], ra: [140, 165], ll: [-55, 15], rl: [55, -15], lift: 26 },
    cheer:    { name: 'Cheer',        view: 'front', la: [-150, -170], ra: [150, 170], ll: [-12, -6], rl: [12, 6] },
    wave:     { name: 'Wave / Hello', view: 'front', la: [-14, -8], ra: [125, 170], ll: [-9, -5], rl: [9, 5] },
    point:    { name: 'Point',        view: 'side', la: [-18, -6], ra: [88, 90], ll: [-12, -6], rl: [12, 4] },
    think:    { name: 'Think',        view: 'front', la: [-40, 50], ra: [25, 168], ll: [-9, -5], rl: [9, 5] },
    scratch:  { name: 'Confused',     view: 'front', la: [-16, -10], ra: [150, -120], ll: [-9, -5], rl: [9, 5] },
    shock:    { name: 'Shocked',      view: 'front', la: [-45, 160], ra: [45, -160], ll: [-10, -4], rl: [10, 4] },
    shrug:    { name: 'Shrug',        view: 'front', la: [-70, -150], ra: [70, 150], ll: [-9, -5], rl: [9, 5] },
    angry:    { name: 'Angry',        view: 'front', la: [-60, 5],   ra: [60, -5],   ll: [-24, -10], rl: [24, 10] },
    fight:    { name: 'Fight stance', view: 'side', lean: 6, la: [30, 150], ra: [70, 160], ll: [-24, -14], rl: [26, 6] },
    punch:    { name: 'Punch',        view: 'side', lean: 12, la: [-30, 150], ra: [90, 90], ll: [-30, -20], rl: [30, 5] },
    kick:     { name: 'Kick',         view: 'side', lean: -12, la: [-80, -120], ra: [60, 140], ll: [-4, -4], rl: [85, 95] },
    carry:    { name: 'Hold out',     view: 'side', la: [45, 95], ra: [55, 95], ll: [-10, -5], rl: [10, 5] },
    sit:      { name: 'Sit (chair)',  view: 'side', la: [25, 85], ra: [35, 90], ll: [88, 2], rl: [92, -2] },
    sitfloor: { name: 'Sit (floor)',  view: 'side', lean: -8, dx: -18, la: [40, 95], ra: [50, 100], ll: [120, 60], rl: [112, 52], ground: 'hip' },
    kneel:    { name: 'Kneel',        view: 'side', la: [-15, -5], ra: [20, 8], ll: [2, -92], rl: [90, 0] },
    pray:     { name: 'Kneel & bow',  view: 'side', lean: 25, head: 20, la: [70, 150], ra: [75, 150], ll: [2, -92], rl: [90, 0] },
    lean:     { name: 'Lean on wall', view: 'side', lean: -6, la: [-20, -10], ra: [150, 172], ll: [16, -8], rl: [-6, 6] },
    dance:    { name: 'Dance',        view: 'front', la: [-60, 30], ra: [140, 170], ll: [-6, -4], rl: [55, 10] },
    tiptoe:   { name: 'Sneak',        view: 'side', lean: 18, la: [60, 130], ra: [40, 110], ll: [-25, -60], rl: [40, -10] },
    fall:     { name: 'Fall over',    view: 'side', lean: -35, dx: 16, la: [-160, -130], ra: [150, 120], ll: [40, 70], rl: [70, 100], lift: 10 },
    sad:      { name: 'Sad / slump',  view: 'side', lean: 10, head: 28, la: [8, 14], ra: [14, 20], ll: [-6, -3], rl: [6, 3] },
    bow:      { name: 'Bow',          view: 'side', lean: 55, head: 25, dx: -22, la: [5, 15], ra: [25, 35], ll: [-4, -2], rl: [4, 2] },
    hug:      { name: 'Arms open',    view: 'front', la: [-100, -125], ra: [100, 125], ll: [-9, -5], rl: [9, 5] },
    fly:      { name: 'Fly / super',  view: 'side', lean: 78, dx: -34, la: [70, 60], ra: [100, 100], ll: [-80, -88], rl: [-72, -95], lift: 40 },
    victory:  { name: 'Victory',      view: 'front', la: [-25, -15], ra: [155, 175], ll: [-20, -10], rl: [20, 10] },
    flex:     { name: 'Flex',         view: 'front', la: [-85, 165], ra: [85, -165], ll: [-16, -8], rl: [16, 8] },
    crossed:  { name: 'Arms crossed', view: 'front', la: [-35, 95], ra: [35, -95], ll: [-8, -4], rl: [8, 4] },
    facepalm: { name: 'Facepalm',     view: 'front', lean: 6, head: 16, la: [-14, -8], ra: [110, -135], ll: [-9, -5], rl: [9, 5] },
    dab:      { name: 'Dab',          view: 'side', lean: 8, head: 24, la: [105, 115], ra: [65, -135], ll: [-18, -10], rl: [22, 6] },
    salute:   { name: 'Salute',       view: 'front', la: [-12, -6], ra: [80, -145], ll: [-7, -4], rl: [7, 4] },
    clap:     { name: 'Clap',         view: 'side', la: [45, 115], ra: [60, 130], ll: [-9, -5], rl: [9, 5] },
    meditate: { name: 'Meditate',     view: 'front', la: [-45, -15], ra: [45, 15], ll: [-75, 70], rl: [75, -70], ground: 'hip', lift: 14 },
    crouch:   { name: 'Crouch',       view: 'side', lean: 32, head: 15, la: [-30, 20], ra: [40, 110], ll: [75, -55], rl: [95, -25] },
    reach:    { name: 'Reach up',     view: 'side', lean: 10, la: [130, 165], ra: [155, 178], ll: [-20, -45], rl: [45, 10] },
    splitjump:{ name: 'Star jump',    view: 'front', la: [-130, -155], ra: [130, 155], ll: [-85, -80], rl: [85, 80], lift: 32 },
    sleep:    { name: 'Sleep / Lie',  view: 'side', lean: 84, dx: -10, la: [95, 110], ra: [85, 100], ll: [-88, -90], rl: [-82, -85], ground: 'hip', fxAuto: ['zzz'] },
  };

  // ---------------------------------------------------------------- characters
  const CHARACTERS = {
    boy:       { name: 'Boy',       prop: 'kid',   hair: 'tuft' },
    girl:      { name: 'Girl',      prop: 'kid',   hair: 'pigtails', dress: true },
    man:       { name: 'Man',       prop: 'adult', hat: 'fedora' },
    woman:     { name: 'Woman',     prop: 'adult', hair: 'long', dress: true },
    cop:       { name: 'Cop',       prop: 'adult', hat: 'police', badge: true, belt: true },
    king:      { name: 'King',      prop: 'adult', hat: 'crown', robe: 'cape', beard: 'short', handR: 'scepter' },
    queen:     { name: 'Queen',     prop: 'adult', hair: 'long', hat: 'tiara', dress: true, robe: 'cape' },
    knight:    { name: 'Knight',    prop: 'adult', hat: 'helmet', armor: true, handR: 'sword', handL: 'shield' },
    wizard:    { name: 'Wizard',    prop: 'adult', hat: 'wizard', beard: 'long', robe: 'long', handL: 'staff' },
    chef:      { name: 'Chef',      prop: 'adult', hat: 'chef', apron: true },
    doctor:    { name: 'Doctor',    prop: 'adult', coat: true, mirror: true },
    pirate:    { name: 'Pirate',    prop: 'adult', hat: 'pirate', patch: true, beard: 'short', handR: 'cutlass' },
    baby:      { name: 'Baby',      prop: 'kid',   hair: 'curl', scale: 0.7 },
    robot:     { name: 'Robot',     prop: 'adult', robot: true },
    ninja:     { name: 'Ninja',     prop: 'adult', hat: 'ninja', belt: true, handR: 'sword' },
    hero:      { name: 'Superhero', prop: 'adult', robe: 'cape', mask: 'domino', emblem: true, belt: true },
    astro:     { name: 'Astronaut', prop: 'adult', hat: 'astro', suit: 'astro' },
    alien:     { name: 'Alien',     prop: 'adult', hat: 'antenna', ears: 'alien' },
    cowboy:    { name: 'Cowboy',    prop: 'adult', hat: 'cowboy', bandana: true, belt: true },
    detective: { name: 'Detective', prop: 'adult', hat: 'deerstalker', coat: true, handR: 'magnifier' },
    witch:     { name: 'Witch',     prop: 'adult', hat: 'witch', hair: 'long', dress: true, robe: 'cape', handR: 'wand' },
    ghost:     { name: 'Ghost',     prop: 'adult', ghost: true },
    angel:     { name: 'Angel',     prop: 'adult', hat: 'halo', wings: 'angel', dress: true },
    devil:     { name: 'Devil',     prop: 'adult', hat: 'horns', wings: 'bat', tail: 'devil', beard: 'goatee', handR: 'trident' },
    artist:    { name: 'Artist',    prop: 'adult', hat: 'beret', apron: true, mustache: true, handR: 'paintbrush' },
    grad:      { name: 'Graduate',  prop: 'adult', hat: 'grad', robe: 'long', handR: 'scroll' },
    athlete:   { name: 'Athlete',   prop: 'kid',   hat: 'cap', jersey: true, handR: 'ball' },
    magician:  { name: 'Magician',  prop: 'adult', hat: 'tophat', robe: 'cape', mustache: true, handR: 'wand' },
  };

  const EXPRESSIONS = {
    happy: 'Happy', neutral: 'Neutral', grin: 'Big grin', laugh: 'Laugh', sad: 'Sad', cry: 'Crying',
    angry: 'Angry', yell: 'Yelling', surprised: 'Surprised', scared: 'Scared', wink: 'Wink',
    cool: 'Cool', sleepy: 'Sleepy', love: 'In love', smirk: 'Smirk', dizzy: 'Dizzy', none: 'No face'
  };

  const FX = {
    speed: 'Speed lines', sweat: 'Sweat', anger: 'Anger mark', steam: 'Steam', shock: 'Shock lines',
    question: '?', exclaim: '!?', love: 'Hearts', zzz: 'Zzz', sparkle: 'Sparkle', dizzy: 'Dizzy stars', bulb: 'Idea bulb'
  };

  const HAND_ITEMS = {
    none: 'Nothing', sword: 'Sword', cutlass: 'Cutlass', shield: 'Shield', staff: 'Staff', scepter: 'Scepter',
    spear: 'Spear', wand: 'Magic wand', bag: 'Handbag', briefcase: 'Briefcase', flower: 'Flower',
    book: 'Book', cup: 'Cup', phone: 'Phone', umbrella: 'Umbrella', sign: 'Sign', balloon: 'Balloon',
    torch: 'Torch', magnifier: 'Magnifier', flag: 'Flag', pan: 'Frying pan', ball: 'Ball', letter: 'Letter',
    paintbrush: 'Paintbrush', trident: 'Trident', scroll: 'Diploma / Scroll'
  };

  // ---------------------------------------------------------------- math helpers
  const rad = a => a * Math.PI / 180;
  const vec = (a, l) => [Math.sin(rad(a)) * l, Math.cos(rad(a)) * l];
  const add = (p, v) => [p[0] + v[0], p[1] + v[1]];
  const f = n => Math.round(n * 10) / 10;
  const P = p => f(p[0]) + ',' + f(p[1]);

  function skeleton(pose, L) {
    const lean = pose.lean || 0;
    const up = 180 - lean;
    const hip = [0, 0];
    const neck = add(hip, vec(up, L.torso));
    const shoulder = add(hip, vec(up, L.torso - 5));
    const headDir = up - (pose.head || 0);
    const headC = add(neck, vec(headDir, L.neck + L.head));
    const arm = a => { const e = add(shoulder, vec(a[0], L.upper)); return { e, h: add(e, vec(a[1], L.lower)), a: a[1] }; };
    const leg = a => { const k = add(hip, vec(a[0], L.thigh)); return { k, f: add(k, vec(a[1], L.shin)) }; };
    const s = { hip, neck, shoulder, headC, headDir, lean, la: arm(pose.la), ra: arm(pose.ra), ll: leg(pose.ll), rl: leg(pose.rl) };
    // grounding
    let maxY = Math.max(s.ll.f[1], s.rl.f[1], s.ll.k[1], s.rl.k[1]);
    if (pose.ground === 'hip') maxY = Math.max(maxY, 0);
    const dy = -maxY - (pose.lift || 0), dx = pose.dx || 0;
    const sh = p => [p[0] + dx, p[1] + dy];
    ['hip', 'neck', 'shoulder', 'headC'].forEach(k => s[k] = sh(s[k]));
    ['la', 'ra'].forEach(k => { s[k].e = sh(s[k].e); s[k].h = sh(s[k].h); });
    ['ll', 'rl'].forEach(k => { s[k].k = sh(s[k].k); s[k].f = sh(s[k].f); });
    return s;
  }

  // ---------------------------------------------------------------- faces
  function face(expr, c, r, side, stroke, flipX) {
    if (expr === 'none') return '';
    const [cx0, cy] = c;
    const cx = cx0 + (side ? r * 0.3 : 0);
    const ex = r * 0.36, ey = cy - r * 0.18, my = cy + r * 0.38;
    const L = (x1, y1, x2, y2, w = 2.4) => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke-width="${w}"/>`;
    const dot = (x, y, rr = 2.3) => `<circle cx="${f(x)}" cy="${f(y)}" r="${rr}" fill="${stroke}" stroke="none"/>`;
    const eyes = () => dot(cx - ex, ey) + dot(cx + ex, ey);
    const smile = (w, d) => `<path d="M${f(cx - w)},${f(my - d / 3)} Q${f(cx)},${f(my + d)} ${f(cx + w)},${f(my - d / 3)}" stroke-width="2.4"/>`;
    const frown = (w, d) => `<path d="M${f(cx - w)},${f(my + d / 2)} Q${f(cx)},${f(my - d)} ${f(cx + w)},${f(my + d / 2)}" stroke-width="2.4"/>`;
    const brows = (inner, outer) => L(cx - ex - 4, ey - 5 + outer, cx - ex + 3, ey - 5 + inner) + L(cx + ex + 4, ey - 5 + outer, cx + ex - 3, ey - 5 + inner);
    const closedEye = (x, up) => `<path d="M${f(x - 3.5)},${f(ey)} Q${f(x)},${f(ey + (up ? -4 : 3))} ${f(x + 3.5)},${f(ey)}" stroke-width="2.2"/>`;
    switch (expr) {
      case 'neutral': return eyes() + L(cx - 5, my + 1, cx + 5, my + 1);
      case 'grin': return eyes() + `<path d="M${f(cx - 8)},${f(my - 2)} Q${f(cx)},${f(my + 9)} ${f(cx + 8)},${f(my - 2)} Z" fill="${PAPER}" stroke-width="2.2"/>` + L(cx - 7, my, cx + 7, my, 1.4);
      case 'laugh': return closedEye(cx - ex, true) + closedEye(cx + ex, true) + `<path d="M${f(cx - 8)},${f(my - 3)} Q${f(cx)},${f(my + 11)} ${f(cx + 8)},${f(my - 3)} Z" fill="${stroke}" stroke-width="2"/>`;
      case 'sad': return eyes() + brows(-3, 1) + frown(5.5, 4);
      case 'cry': return closedEye(cx - ex, false) + closedEye(cx + ex, false) + brows(-3, 1) + frown(6, 5)
        + `<path d="M${f(cx - ex)},${f(ey + 4)} q-2,6 0,8 q2,-2 0,-8" fill="#5ab4f0" stroke="#2a7fc0" stroke-width="1.2"/><path d="M${f(cx + ex)},${f(ey + 4)} q-2,6 0,8 q2,-2 0,-8" fill="#5ab4f0" stroke="#2a7fc0" stroke-width="1.2"/>`;
      case 'angry': return eyes() + brows(3, -2) + frown(5.5, 3);
      case 'yell': return eyes() + brows(4, -2) + `<ellipse cx="${f(cx)}" cy="${f(my + 1)}" rx="6" ry="5" fill="${stroke}" stroke-width="1.5"/>`;
      case 'surprised': return `<circle cx="${f(cx - ex)}" cy="${f(ey)}" r="3.3" fill="${PAPER}" stroke-width="1.8"/><circle cx="${f(cx + ex)}" cy="${f(ey)}" r="3.3" fill="${PAPER}" stroke-width="1.8"/>` + dot(cx - ex, ey, 1.3) + dot(cx + ex, ey, 1.3) + brows(-2, -1) + `<ellipse cx="${f(cx)}" cy="${f(my + 1)}" rx="3.5" ry="4.5" fill="${PAPER}" stroke-width="2"/>`;
      case 'scared': return `<circle cx="${f(cx - ex)}" cy="${f(ey)}" r="3.6" fill="${PAPER}" stroke-width="1.8"/><circle cx="${f(cx + ex)}" cy="${f(ey)}" r="3.6" fill="${PAPER}" stroke-width="1.8"/>` + dot(cx - ex, ey + 0.5, 1.2) + dot(cx + ex, ey + 0.5, 1.2) + brows(-4, 1)
        + `<path d="M${f(cx - 7)},${f(my + 1)} l2.3,-2.5 l2.3,2.5 l2.3,-2.5 l2.3,2.5 l2.3,-2.5" stroke-width="1.8"/>`;
      case 'wink': return dot(cx - ex, ey) + closedEye(cx + ex, true) + smile(6, 4);
      case 'cool': return `<path d="M${f(cx - ex - 5)},${f(ey - 3)} h${f(2 * ex + 10)} v2 q-1,5 -5,5 h-${f(ex * 0.5)} q-3,0 -4,-4 h-2 q-1,4 -4,4 h-${f(ex * 0.5)} q-4,0 -5,-5 z" fill="${stroke}" stroke-width="1.4"/>` + `<path d="M${f(cx - 4)},${f(my)} Q${f(cx + 2)},${f(my + 4)} ${f(cx + 6)},${f(my - 2)}" stroke-width="2.2"/>`;
      case 'sleepy': return L(cx - ex - 3, ey + 1, cx - ex + 3, ey + 1, 2) + L(cx + ex - 3, ey + 1, cx + ex + 3, ey + 1, 2) + `<ellipse cx="${f(cx)}" cy="${f(my + 1)}" rx="2.5" ry="2" stroke-width="1.8"/>`;
      case 'love': {
        const h = (x) => `<path d="M${f(x)},${f(ey + 3)} l-3.6,-3.6 a2,2 0 0 1 3.6,-2.6 a2,2 0 0 1 3.6,2.6 z" fill="#e0245e" stroke="#e0245e" stroke-width="1"/>`;
        return h(cx - ex) + h(cx + ex) + smile(6, 5);
      }
      case 'smirk': return eyes() + `<path d="M${f(cx - 5)},${f(my + 1)} Q${f(cx + 2)},${f(my + 3)} ${f(cx + 6)},${f(my - 3)}" stroke-width="2.4"/>`;
      case 'dizzy': {
        const x = (x0) => L(x0 - 3, ey - 3, x0 + 3, ey + 3, 2) + L(x0 - 3, ey + 3, x0 + 3, ey - 3, 2);
        return x(cx - ex) + x(cx + ex) + `<path d="M${f(cx - 6)},${f(my + 1)} q3,-4 6,0 q3,4 6,0" stroke-width="2"/>`;
      }
      default: return eyes() + smile(6, 5);
    }
  }

  // ---------------------------------------------------------------- hand items
  function handItem(kind, hand, stroke, side) {
    const [x, y] = hand.h, a = hand.a;
    const T = `translate(${f(x)},${f(y)})`;
    const along = inner => `<g transform="${T} rotate(${f(-a)})">${inner}</g>`;
    const up = inner => `<g transform="${T}">${inner}</g>`;
    switch (kind) {
      case 'sword': return along(`<path d="M-2.5,6 L-2.5,52 L0,58 L2.5,52 L2.5,6 Z" fill="#e8eef3" stroke-width="2"/><line x1="-9" y1="5" x2="9" y2="5" stroke-width="3.2"/><line x1="0" y1="-6" x2="0" y2="5" stroke-width="3.2"/><circle cx="0" cy="-8" r="2.5" fill="${stroke}"/>`);
      case 'cutlass': return along(`<path d="M-2,6 L-3,40 Q2,56 9,50 Q4,38 3,6 Z" fill="#e8eef3" stroke-width="2"/><path d="M-8,5 Q0,-8 9,5" stroke-width="2.4"/><line x1="0" y1="-6" x2="0" y2="5" stroke-width="3.2"/>`);
      case 'shield': return up(`<path d="M-17,-22 L17,-22 L17,0 Q17,18 0,26 Q-17,18 -17,0 Z" fill="${PAPER}" stroke-width="3"/><path d="M0,-18 L0,20 M-13,-6 L13,-6" stroke-width="2.2"/>`);
      case 'staff': return up(`<line x1="0" y1="-78" x2="0" y2="62" stroke-width="3.2"/><path d="M0,-78 q-10,-4 -8,-14 q4,-8 11,-3 q4,5 -2,8" stroke-width="3"/>`);
      case 'scepter': return up(`<line x1="0" y1="-34" x2="0" y2="18" stroke-width="3.2"/><circle cx="0" cy="-39" r="5" fill="${PAPER}" stroke-width="2.4"/><line x1="0" y1="-50" x2="0" y2="-44" stroke-width="2"/><line x1="-3" y1="-47" x2="3" y2="-47" stroke-width="2"/>`);
      case 'spear': return up(`<line x1="0" y1="-92" x2="0" y2="70" stroke-width="3"/><path d="M0,-108 L-5,-92 L5,-92 Z" fill="${PAPER}" stroke-width="2.4"/>`);
      case 'wand': return along(`<line x1="0" y1="0" x2="0" y2="24" stroke-width="2.6"/><path d="M0,26 l2,5 5,0 -4,3 2,5 -5,-3 -5,3 2,-5 -4,-3 5,0z" fill="#ffd23c" stroke-width="1.4"/>`);
      case 'bag': return up(`<path d="M-7,2 Q0,-6 7,2" stroke-width="2.2"/><path d="M-11,2 L11,2 L9,20 L-9,20 Z" fill="${PAPER}" stroke-width="2.4"/>`);
      case 'briefcase': return up(`<path d="M-5,2 v-4 h10 v4" stroke-width="2.2"/><rect x="-15" y="2" width="30" height="20" rx="2" fill="${PAPER}" stroke-width="2.4"/><line x1="-15" y1="10" x2="15" y2="10" stroke-width="1.6"/>`);
      case 'flower': return up(`<path d="M0,6 Q-3,-10 0,-24" stroke="#2d8a3e" stroke-width="2.2"/><path d="M0,-12 q6,-6 9,-2 q-5,4 -9,2" fill="#6cc070" stroke="#2d8a3e" stroke-width="1.2"/>${[0, 72, 144, 216, 288].map(r => `<ellipse cx="0" cy="-30" rx="3.2" ry="5.5" transform="rotate(${r} 0 -24)" fill="#ff7aa8" stroke-width="1.4"/>`).join('')}<circle cx="0" cy="-24" r="3" fill="#ffd23c" stroke-width="1.2"/>`);
      case 'book': return up(`<path d="M-14,-6 L0,-2 L14,-6 L14,12 L0,16 L-14,12 Z" fill="${PAPER}" stroke-width="2.2"/><line x1="0" y1="-2" x2="0" y2="16" stroke-width="1.6"/>`);
      case 'cup': return up(`<path d="M-6,-10 L6,-10 L5,4 L-5,4 Z" fill="${PAPER}" stroke-width="2.2"/><path d="M6,-7 q5,0 4,4 q-1,3 -5,2" stroke-width="1.8"/><path d="M-2,-14 q2,-3 0,-6 M2,-14 q2,-3 0,-6" stroke-width="1.2"/>`);
      case 'phone': return up(`<rect x="-4" y="-12" width="8" height="15" rx="1.5" fill="${PAPER}" stroke-width="2"/>`);
      case 'umbrella': return up(`<line x1="0" y1="8" x2="0" y2="-56" stroke-width="2.4"/><path d="M0,8 q0,5 -5,4" stroke-width="2.4"/><path d="M-34,-50 Q0,-88 34,-50 Q25,-56 17,-50 Q9,-57 0,-50 Q-9,-57 -17,-50 Q-25,-56 -34,-50 Z" fill="#ff6b6b" stroke-width="2.4"/>`);
      case 'sign': return up(`<line x1="0" y1="10" x2="0" y2="-48" stroke-width="3"/><rect x="-30" y="-82" width="60" height="36" rx="2" fill="${PAPER}" stroke-width="2.6"/>`);
      case 'balloon': return up(`<path d="M0,0 q-6,-20 0,-40 q6,-12 0,-22" stroke-width="1.4"/><ellipse cx="0" cy="-76" rx="13" ry="16" fill="#ff5a5a" stroke-width="2.2"/><path d="M-2,-60 l2,3 2,-3z" fill="#ff5a5a" stroke-width="1.4"/>`);
      case 'torch': return up(`<path d="M-3,10 L-4,-22 L4,-22 L3,10 Z" fill="#b07a4a" stroke-width="2"/><path d="M-6,-22 Q-9,-34 0,-46 Q2,-36 6,-38 Q10,-30 6,-22 Z" fill="#ffa53c" stroke="#e05a00" stroke-width="2"/>`);
      case 'magnifier': return along(`<line x1="0" y1="0" x2="0" y2="14" stroke-width="3.2"/><circle cx="0" cy="23" r="9" fill="#e6f3ff" stroke-width="2.6"/>`);
      case 'flag': return up(`<line x1="0" y1="12" x2="0" y2="-70" stroke-width="2.6"/><path d="M0,-70 Q14,-76 28,-68 Q20,-60 28,-50 Q14,-56 0,-50 Z" fill="#4a90e2" stroke-width="2.2"/>`);
      case 'pan': return along(`<line x1="0" y1="0" x2="0" y2="18" stroke-width="3.4"/><ellipse cx="0" cy="30" rx="11" ry="12" fill="#555" stroke-width="2.4"/>`);
      case 'ball': return up(`<circle cx="0" cy="-10" r="10" fill="#ff9f43" stroke-width="2.2"/><path d="M-10,-10 h20 M0,-20 v20" stroke-width="1.4"/>`);
      case 'letter': return up(`<rect x="-12" y="-12" width="24" height="16" fill="${PAPER}" stroke-width="2"/><path d="M-12,-12 L0,-3 L12,-12" stroke-width="1.6"/>`);
      case 'paintbrush': return along(`<line x1="0" y1="0" x2="0" y2="24" stroke-width="2.8"/><path d="M-2,24 L2,24 L3,31 Q0,35 -3,31 Z" fill="#e74c3c" stroke-width="1.6"/>`);
      case 'trident': return up(`<line x1="0" y1="-82" x2="0" y2="62" stroke-width="3"/><path d="M-10,-96 L-10,-80 Q0,-74 10,-80 L10,-96 M0,-102 L0,-77" stroke-width="2.6"/><path d="M-10,-96 l-2,4 M0,-102 l-2,4 M10,-96 l-2,4" stroke-width="2"/>`);
      case 'scroll': return along(`<rect x="-4" y="-8" width="8" height="24" rx="3" fill="${PAPER}" stroke-width="2.2"/><line x1="-4" y1="4" x2="4" y2="4" stroke="#e74c3c" stroke-width="2.6"/>`);
      default: return '';
    }
  }

  // ---------------------------------------------------------------- fx
  function effects(list, s, r, stroke, flipX) {
    if (!list || !list.length) return '';
    const [hx, hy] = s.headC;
    const txt = (x, y, t, size, fill = stroke, rot = 0) =>
      `<g transform="translate(${f(x)},${f(y)}) scale(${flipX ? -1 : 1},1) rotate(${rot})"><text x="0" y="0" text-anchor="middle" font-family="Comic Sans MS, Segoe Print, cursive" font-weight="bold" font-size="${size}" fill="${fill}" stroke="none">${t}</text></g>`;
    let out = '';
    for (const fx of list) {
      switch (fx) {
        case 'speed': {
          const bx = Math.min(s.hip[0], s.neck[0]) - 26;
          [[-20, 0], [-5, 16], [10, 8], [25, 22], [-35, 12]].forEach(([dy, dl], i) => {
            const y = s.hip[1] - 10 + dy * 1.1;
            out += `<line x1="${f(bx - dl)}" y1="${f(y)}" x2="${f(bx - 38 - dl - i * 4)}" y2="${f(y)}" stroke-width="2.2"/>`;
          });
          break;
        }
        case 'sweat':
          [[r + 7, -r * 0.2, 0.9], [r + 2, -r - 2, 0.75], [-r - 6, -r * 0.4, 0.7]].forEach(([dx, dy, k]) => {
            out += `<path transform="translate(${f(hx + dx)},${f(hy + dy)}) scale(${k})" d="M0,-6 Q5,2 0,5 Q-5,2 0,-6 Z" fill="#9fd4ff" stroke-width="1.6"/>`;
          });
          break;
        case 'anger': {
          const x = hx + r + 8, y = hy - r - 4;
          out += `<g transform="translate(${f(x)},${f(y)})" stroke="#d62828" stroke-width="2.6"><path d="M-7,-2 q5,0 5,-5 M2,-7 q0,5 5,5 M7,2 q-5,0 -5,5 M-2,7 q0,-5 -5,-5"/></g>`;
          break;
        }
        case 'steam':
          [[-1, hx - r - 14], [1, hx + r + 14]].forEach(([d, x]) => {
            const y = hy - r - 6;
            out += `<path d="M${f(x)},${f(y)} q-6,-2 -4,-8 q2,-6 8,-4 q4,-6 10,-1 q5,4 0,9 q-2,6 -8,4 q-6,3 -6,0 z" transform="scale(1,1)" fill="${PAPER}" stroke-width="2"/>`;
            out += `<path d="M${f(x - d * 4)},${f(y + 10)} l${-d * 6},6" stroke-width="2"/>`;
          });
          break;
        case 'shock':
          for (let i = 0; i < 7; i++) {
            const ang = -150 + i * 20 + 90; // around top
            const a = rad(ang - 90 - 90);
            const x1 = hx + Math.cos(a) * (r + 6), y1 = hy + Math.sin(a) * (r + 6);
            const x2 = hx + Math.cos(a) * (r + 14), y2 = hy + Math.sin(a) * (r + 14);
            out += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke-width="2.2"/>`;
          }
          break;
        case 'question': out += txt(hx + r + 10, hy - r + 2, '?', 26); break;
        case 'exclaim': out += txt(hx + r + 12, hy - r, '!?', 24); break;
        case 'love':
          [[r + 10, -r - 4, 1], [r + 20, -r - 18, 0.7], [-r - 10, -r - 10, 0.8]].forEach(([dx, dy, k]) => {
            out += `<path transform="translate(${f(hx + dx)},${f(hy + dy)}) scale(${k})" d="M0,6 l-6,-6 a3.4,3.4 0 0 1 6,-4.4 a3.4,3.4 0 0 1 6,4.4 z" fill="#ff4d7d" stroke="#c9184a" stroke-width="1.4"/>`;
          });
          break;
        case 'zzz': out += txt(hx + r + 8, hy - r + 2, 'z', 14, stroke, -10) + txt(hx + r + 18, hy - r - 10, 'z', 18, stroke, -10) + txt(hx + r + 30, hy - r - 24, 'Z', 22, stroke, -10); break;
        case 'sparkle':
          [[-r - 12, -r, 1], [r + 12, -r - 6, 1.2], [r + 4, -r - 22, 0.7]].forEach(([dx, dy, k]) => {
            out += `<path transform="translate(${f(hx + dx)},${f(hy + dy)}) scale(${k})" d="M0,-8 Q1,-1 8,0 Q1,1 0,8 Q-1,1 -8,0 Q-1,-1 0,-8 Z" fill="#ffd23c" stroke-width="1.4"/>`;
          });
          break;
        case 'dizzy':
          out += `<ellipse cx="${f(hx)}" cy="${f(hy - r - 6)}" rx="${f(r + 8)}" ry="5" stroke-width="1.6" stroke-dasharray="3 3"/>`;
          [[-r, -r - 6], [r - 2, -r - 8], [0, -r - 1]].forEach(([dx, dy]) => {
            out += `<path transform="translate(${f(hx + dx)},${f(hy + dy)}) scale(0.7)" d="M0,-8 l2.4,5 5.6,.8 -4,3.9 1,5.5 -5,-2.6 -5,2.6 1,-5.5 -4,-3.9 5.6,-.8z" fill="#ffd23c" stroke-width="1.6"/>`;
          });
          break;
        case 'bulb': {
          const x = hx + r + 14, y = hy - r - 14;
          out += `<g transform="translate(${f(x)},${f(y)})"><path d="M-7,4 a9,9 0 1 1 14,0 l-2,5 h-10 z" fill="#fff36b" stroke-width="2"/><path d="M-4,12 h8 M-3,15 h6" stroke-width="1.8"/>`
            + [[-16, -6], [-12, -16], [0, -21], [12, -16], [16, -6]].map(([a, b]) => `<line x1="${a * 0.8}" y1="${b * 0.8}" x2="${a}" y2="${b}" stroke-width="1.8"/>`).join('') + `</g>`;
          break;
        }
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- main renderer
  function drawFigure(it) {
    const ch = CHARACTERS[it.char] || CHARACTERS.boy;
    const pose = POSES[it.pose] || POSES.stand;
    const L = PROPORTIONS[ch.prop];
    const s = skeleton(pose, L);
    const stroke = it.color || '#1d1d1d';
    const lw = it.lw || 4;
    const cloth = it.cloth || PAPER;
    const side = pose.view === 'side';
    const r = L.head;
    const [hx, hy] = s.headC;
    let back = '', body = '', front = '', head = '', over = '';

    const line = (pts, w = lw) => `<polyline points="${pts.map(P).join(' ')}" stroke-width="${w}"/>`;
    const tdir = (a) => vec(180 - s.lean, a); // along torso upward
    const perp = (a) => vec(90 - s.lean, a);  // perpendicular to torso (forward)

    // --- robe / cape / wings / tail (behind)
    if (ch.wings === 'angel') {
      const sh = s.shoulder;
      const wSide = (d) => `<path d="M${P(sh)} Q${f(sh[0] + d * 24)},${f(sh[1] - 28)} ${f(sh[0] + d * 36)},${f(sh[1] - 8)} Q${f(sh[0] + d * 34)},${f(sh[1] + 10)} ${f(sh[0] + d * 22)},${f(sh[1] + 12)} Q${f(sh[0] + d * 26)},${f(sh[1] + 18)} ${f(sh[0] + d * 14)},${f(sh[1] + 18)} Q${f(sh[0] + d * 8)},${f(sh[1] + 14)} ${P(sh)} Z" fill="${PAPER}" stroke-width="${lw * 0.7}"/>`;
      back += side ? wSide(-1) : (wSide(-1) + wSide(1));
    }
    if (ch.wings === 'bat') {
      const sh = s.shoulder;
      const wSide = (d) => `<path d="M${P(sh)} L${f(sh[0] + d * 30)},${f(sh[1] - 20)} Q${f(sh[0] + d * 28)},${f(sh[1] - 2)} ${f(sh[0] + d * 32)},${f(sh[1] + 8)} Q${f(sh[0] + d * 20)},${f(sh[1] + 4)} ${f(sh[0] + d * 18)},${f(sh[1] + 16)} Q${f(sh[0] + d * 10)},${f(sh[1] + 6)} ${P(sh)} Z" fill="${it.cloth || '#2d3436'}" stroke-width="${lw * 0.7}"/>`;
      back += side ? wSide(-1) : (wSide(-1) + wSide(1));
    }
    if (ch.tail === 'devil') {
      const hp = s.hip;
      back += `<path d="M${P(hp)} Q${f(hp[0] - 24)},${f(hp[1] + 12)} ${f(hp[0] - 28)},${f(hp[1] - 12)} Q${f(hp[0] - 30)},${f(hp[1] - 24)} ${f(hp[0] - 22)},${f(hp[1] - 26)}" stroke="#c0392b" stroke-width="2.6"/>`
        + `<path d="M${f(hp[0] - 22)},${f(hp[1] - 26)} l-5,-3 l8,-2 l-1,8 z" fill="#c0392b" stroke="#c0392b" stroke-width="1"/>`;
    }
    if (ch.robe === 'cape') {
      const top = s.shoulder;
      const bl = [s.hip[0] - 34 + s.lean * 0.4, GROUND - GROUND + Math.max(s.ll.f[1], s.rl.f[1]) - 4];
      const br = [s.hip[0] + 30 + s.lean * 0.6, bl[1] + 2];
      const capeFill = it.cloth || (ch.hat === 'witch' ? '#4a2c6b' : ch.hat === 'tophat' ? '#2d3436' : '#c0392b');
      back += `<path d="M${P(add(top, perp(-10)))} Q${P([bl[0] + 6, (top[1] + bl[1]) / 2])} ${P(bl)} Q${P([(bl[0] + br[0]) / 2, bl[1] + 6])} ${P(br)} Q${P([br[0] - 8, (top[1] + br[1]) / 2])} ${P(add(top, perp(10)))} Z" fill="${capeFill}" stroke-width="${lw * 0.8}"/>`;
      back += `<path d="M${P(add(s.neck, perp(-12)))} Q${P(add(s.neck, [0, 6]))} ${P(add(s.neck, perp(12)))}" stroke-width="${lw * 1.6}" stroke-dasharray="1 5"/>`;
    }

    // --- legs
    const foot = (leg, dir) => { const d = side ? 1 : dir; return `<line x1="${f(leg.f[0])}" y1="${f(leg.f[1])}" x2="${f(leg.f[0] + d * 7)}" y2="${f(leg.f[1])}" stroke-width="${lw}"/>`; };
    let legs = ch.ghost ? '' : (line([s.hip, s.ll.k, s.ll.f]) + line([s.hip, s.rl.k, s.rl.f]) + foot(s.ll, -1) + foot(s.rl, 1));
    if (ch.armor) legs += line([s.hip, s.ll.k, s.ll.f], lw + 5).replace('<polyline', `<polyline opacity="0.18"`) + `<circle cx="${f(s.ll.k[0])}" cy="${f(s.ll.k[1])}" r="4" fill="${PAPER}" stroke-width="2"/><circle cx="${f(s.rl.k[0])}" cy="${f(s.rl.k[1])}" r="4" fill="${PAPER}" stroke-width="2"/>`;
    if (ch.robot) legs = line([s.hip, s.ll.k, s.ll.f], lw + 3) + line([s.hip, s.rl.k, s.rl.f], lw + 3) + `<rect x="${f(s.ll.f[0] - 6)}" y="${f(s.ll.f[1] - 5)}" width="14" height="5" fill="${stroke}"/><rect x="${f(s.rl.f[0] - 6)}" y="${f(s.rl.f[1] - 5)}" width="14" height="5" fill="${stroke}"/>`;
    body += legs;

    // --- torso
    const torsoLine = line([s.hip, s.neck]);
    if (ch.ghost) {
      const g = Math.max(s.ll.f[1], s.rl.f[1]) - 4;
      const cxr = s.hip[0] + s.lean * 0.2;
      body += `<path d="M${P(add(s.neck, perp(-9)))} L${f(cxr - 22)},${f(g)} Q${f(cxr - 14)},${f(g - 8)} ${f(cxr - 7)},${f(g)} Q${f(cxr)},${f(g + 7)} ${f(cxr + 7)},${f(g)} Q${f(cxr + 14)},${f(g - 8)} ${f(cxr + 22)},${f(g)} L${P(add(s.neck, perp(9)))} Z" fill="${cloth}" stroke-width="${lw * 0.8}"/>`;
    } else if (ch.robe === 'long') {
      const g = Math.max(s.ll.f[1], s.rl.f[1]) - 2;
      const spread = Math.max(22, Math.abs(s.ll.f[0] - s.rl.f[0]) / 2 + 12);
      const cxr = (s.ll.f[0] + s.rl.f[0]) / 2;
      const robeFill = it.cloth || (ch.hat === 'grad' ? '#2d3436' : '#6c5ce7');
      body += `<path d="M${P(add(s.neck, perp(-7)))} L${f(cxr - spread)},${f(g)} Q${f(cxr)},${f(g + 5)} ${f(cxr + spread)},${f(g)} L${P(add(s.neck, perp(7)))} Z" fill="${robeFill}" stroke-width="${lw * 0.8}"/>`;
      if (ch.hat !== 'grad') body += `<path d="M${f(cxr - spread * 0.5)},${f(g - 20)} l3,-5 3,5 M${f(cxr + spread * 0.4)},${f(g - 50)} l3,-5 3,5" stroke-width="1.6"/>`;
    } else if (ch.dress) {
      const top = add(s.neck, tdir(-10));
      const hemY = s.hip[1] + 20;
      const hx0 = s.hip[0] + s.lean * 0.2;
      body += torsoLine + `<path d="M${P(add(top, perp(-5)))} L${f(hx0 - 20)},${f(hemY)} Q${f(hx0)},${f(hemY + 4)} ${f(hx0 + 20)},${f(hemY)} L${P(add(top, perp(5)))} Z" fill="${cloth}" stroke-width="${lw * 0.8}"/>`;
    } else if (ch.armor) {
      const a = add(s.neck, tdir(-6)), b = add(s.hip, tdir(-2));
      body += `<path d="M${P(add(a, perp(-12)))} L${P(add(a, perp(12)))} L${P(add(b, perp(10)))} L${P(add(b, perp(-10)))} Z" fill="${it.cloth || '#dfe6e9'}" stroke-width="${lw * 0.8}"/>`
        + `<line x1="${P(add(b, perp(-10))).split(',')[0]}" y1="${P(add(b, perp(-10))).split(',')[1]}" x2="${P(add(b, perp(10))).split(',')[0]}" y2="${P(add(b, perp(10))).split(',')[1]}" stroke-width="3"/>`
        + `<path d="M${P(add(add(a, tdir(-10)), perp(-6)))} L${P(add(add(a, tdir(-10)), perp(6)))}" stroke-width="2"/>`;
    } else if (ch.robot) {
      const a = add(s.neck, tdir(-4)), b = add(s.hip, tdir(2));
      body += `<path d="M${P(add(a, perp(-13)))} L${P(add(a, perp(13)))} L${P(add(b, perp(13)))} L${P(add(b, perp(-13)))} Z" fill="${it.cloth || '#dfe6e9'}" stroke-width="${lw * 0.8}"/>`
        + `<circle cx="${f((a[0] + b[0]) / 2)}" cy="${f((a[1] + b[1]) / 2)}" r="4" fill="#ff4757" stroke-width="1.6"/>`;
    } else if (ch.suit === 'astro') {
      const a = add(s.neck, tdir(-4)), b = add(s.hip, tdir(2));
      body += `<path d="M${P(add(a, perp(-12)))} L${P(add(a, perp(12)))} L${P(add(b, perp(11)))} L${P(add(b, perp(-11)))} Z" fill="${it.cloth || '#f5f6fa'}" stroke-width="${lw * 0.8}"/>`
        + `<rect x="${f((a[0] + b[0]) / 2 - 6)}" y="${f((a[1] + b[1]) / 2 - 5)}" width="12" height="10" rx="1.5" fill="#dfe6e9" stroke-width="1.8"/>`
        + `<circle cx="${f((a[0] + b[0]) / 2 - 2)}" cy="${f((a[1] + b[1]) / 2)}" r="1.5" fill="#e74c3c" stroke="none"/><circle cx="${f((a[0] + b[0]) / 2 + 2.5)}" cy="${f((a[1] + b[1]) / 2)}" r="1.5" fill="#3498db" stroke="none"/>`;
    } else {
      body += torsoLine;
      if (ch.jersey) {
        const a = add(s.neck, tdir(-4)), b = add(s.hip, tdir(2));
        body += `<path d="M${P(add(a, perp(-9)))} L${P(add(a, perp(9)))} L${P(add(b, perp(8)))} L${P(add(b, perp(-8)))} Z" fill="${it.cloth || '#3498db'}" stroke-width="${lw * 0.7}"/>`
          + `<line x1="${f(add(a, tdir(-12))[0] - 5)}" y1="${f(add(a, tdir(-12))[1])}" x2="${f(add(a, tdir(-12))[0] + 5)}" y2="${f(add(a, tdir(-12))[1])}" stroke="${PAPER}" stroke-width="2"/>`;
      }
      if (ch.coat) {
        const a = add(s.neck, tdir(-4)), b = add(s.hip, tdir(-18));
        body += `<path d="M${P(add(a, perp(-6)))} L${P(add(b, perp(-13)))} L${P(add(b, perp(13)))} L${P(add(a, perp(6)))} Z" fill="${it.cloth || PAPER}" stroke-width="${lw * 0.7}"/>` + torsoLine.replace(`stroke-width="${lw}"`, `stroke-width="1.5"`);
      }
      if (ch.apron) {
        const a = add(s.neck, tdir(-14)), b = add(s.hip, tdir(-16));
        body += `<path d="M${P(add(a, perp(-7)))} L${P(add(a, perp(7)))} L${P(add(b, perp(11)))} L${P(add(b, perp(-11)))} Z" fill="${it.cloth || PAPER}" stroke-width="${lw * 0.7}"/>`;
      }
    }
    if (ch.emblem) { const c = add(s.neck, tdir(-16)); body += `<path transform="translate(${P(c)}) scale(0.7)" d="M0,-8 L7,0 L0,8 L-7,0 Z" fill="#ffd23c" stroke-width="2"/>`; }
    if (ch.bandana) { const n = s.neck; body += `<path d="M${P(add(n, perp(-7)))} L${P(add(n, perp(7)))} L${P(add(n, tdir(-12)))} Z" fill="#e74c3c" stroke-width="2"/>`; }
    if (ch.badge) { const b = add(s.neck, tdir(-14)); const c = add(b, perp(5)); body += `<path transform="translate(${P(c)}) scale(0.55)" d="M0,-8 l2.4,5 5.6,.8 -4,3.9 1,5.5 -5,-2.6 -5,2.6 1,-5.5 -4,-3.9 5.6,-.8z" fill="#ffd23c" stroke-width="2.4"/>`; }
    if (ch.belt) { const b = add(s.hip, tdir(4)); body += `<line x1="${f(add(b, perp(-7))[0])}" y1="${f(add(b, perp(-7))[1])}" x2="${f(add(b, perp(7))[0])}" y2="${f(add(b, perp(7))[1])}" stroke-width="${lw + 2}"/>`; }
    if (ch.mirror) { const b = add(s.neck, tdir(-9)); body += `<path d="M${P(add(b, perp(-5)))} Q${P(add(add(b, tdir(-14)), perp(0)))} ${P(add(b, perp(5)))}" stroke-width="1.6"/><circle cx="${f(add(add(b, tdir(-15)), perp(0))[0])}" cy="${f(add(add(b, tdir(-15)), perp(0))[1])}" r="3" fill="#ccc" stroke-width="1.4"/>`; }

    // --- hand items (left hand item behind the body for side views)
    const hL = it.handL !== undefined ? it.handL : (ch.handL || 'none');
    const hR = it.handR !== undefined ? it.handR : (ch.handR || 'none');
    if (hL && hL !== 'none' && hL !== 'shield') back += handItem(hL, s.la, stroke, side);

    // --- arms
    const armW = ch.robot ? lw + 3 : lw;
    let arms = line([s.shoulder, s.la.e, s.la.h], armW) + line([s.shoulder, s.ra.e, s.ra.h], armW);
    if (ch.armor) arms += `<circle cx="${f(s.shoulder[0])}" cy="${f(s.shoulder[1])}" r="6" fill="${it.cloth || '#dfe6e9'}" stroke-width="2.2"/>`;
    if (ch.robe === 'long') arms += `<path d="M${P(add(s.la.h, vec(s.la.a + 180, 8)))} l${f(vec(s.la.a + 90, 5)[0])},${f(vec(s.la.a + 90, 5)[1])}" stroke-width="3"/>`;
    front += arms;
    if (hR && hR !== 'none' && hR !== 'shield') front += handItem(hR, s.ra, stroke, side);
    if (hL === 'shield') front += handItem('shield', s.la, stroke, side);
    if (hR === 'shield') front += handItem('shield', s.ra, stroke, side);

    // --- head
    const baseR = r;
    if (ch.ears === 'alien') {
      head += `<path d="M${f(hx - r + 2)},${f(hy - 4)} L${f(hx - r - 10)},${f(hy - 14)} L${f(hx - r + 4)},${f(hy + 4)} Z" fill="${PAPER}" stroke-width="2.2"/>`
        + `<path d="M${f(hx + r - 2)},${f(hy - 4)} L${f(hx + r + 10)},${f(hy - 14)} L${f(hx + r - 4)},${f(hy + 4)} Z" fill="${PAPER}" stroke-width="2.2"/>`;
    }
    if (ch.hair === 'long') {
      head += `<path d="M${f(hx - r - 2)},${f(hy - 2)} Q${f(hx - r - 6)},${f(hy + r + 10)} ${f(hx - r + 2)},${f(hy + r + 14)} L${f(hx + r - 2)},${f(hy + r + 14)} Q${f(hx + r + 6)},${f(hy + r + 10)} ${f(hx + r + 2)},${f(hy - 2)} Z" fill="${it.hairColor || stroke}" fill-opacity="${it.hairColor ? 1 : 0.0}" stroke-width="${lw * 0.7}"/>`;
    }
    if (ch.robot) {
      head += `<rect x="${f(hx - r)}" y="${f(hy - r)}" width="${f(2 * r)}" height="${f(2 * r)}" rx="4" fill="${PAPER}" stroke-width="${lw}"/><line x1="${f(hx)}" y1="${f(hy - r)}" x2="${f(hx)}" y2="${f(hy - r - 9)}" stroke-width="2.4"/><circle cx="${f(hx)}" cy="${f(hy - r - 11)}" r="3" fill="#ff4757" stroke-width="1.6"/>`;
    } else {
      head += `<circle cx="${f(hx)}" cy="${f(hy)}" r="${baseR}" fill="${PAPER}" stroke-width="${lw}"/>`;
    }
    if (ch.hat === 'ninja') {
      const nf = it.cloth || '#2d3436';
      head += `<path d="M${f(hx - r)},${f(hy - 5)} A${r},${r} 0 0 1 ${f(hx + r)},${f(hy - 5)} Z" fill="${nf}" stroke-width="2"/>`
        + `<path d="M${f(hx - r)},${f(hy + 1)} A${r},${r} 0 0 0 ${f(hx + r)},${f(hy + 1)} Z" fill="${nf}" stroke-width="2"/>`
        + `<path d="M${f(hx - r - 1)},${f(hy - 6)} l-10,-3 m10,5 l-9,3" stroke="${nf}" stroke-width="2.4"/>`;
    }
    if (ch.mask === 'domino') {
      const mx = hx + (side ? r * 0.3 : 0), my = hy - r * 0.18;
      head += `<path d="M${f(mx - r * 0.65)},${f(my - 4)} Q${f(mx)},${f(my - 2)} ${f(mx + r * 0.65)},${f(my - 4)} L${f(mx + r * 0.6)},${f(my + 4)} Q${f(mx)},${f(my + 2)} ${f(mx - r * 0.6)},${f(my + 4)} Z" fill="${it.cloth || '#2d3436'}" stroke="none"/>`;
    }
    head += face(it.expr || 'happy', s.headC, r, side, stroke, it.flipX);

    // hair
    if (ch.hair === 'tuft') head += `<path d="M${f(hx - 5)},${f(hy - r + 1)} l1,-7 M${f(hx)},${f(hy - r)} l2,-8 M${f(hx + 5)},${f(hy - r + 1)} l4,-6" stroke-width="2.4"/>`;
    if (ch.hair === 'curl') head += `<path d="M${f(hx)},${f(hy - r)} q-4,-6 1,-8 q5,0 2,4" stroke-width="2"/>`;
    if (ch.hair === 'pigtails' || ch.hair === 'long') {
      head += `<path d="M${f(hx - r)},${f(hy - 2)} Q${f(hx - r + 2)},${f(hy - r - 5)} ${f(hx)},${f(hy - r - 1)} Q${f(hx + r - 2)},${f(hy - r - 5)} ${f(hx + r)},${f(hy - 2)} Q${f(hx + 6)},${f(hy - r + 5)} ${f(hx - 2)},${f(hy - r + 4)} Q${f(hx - r + 4)},${f(hy - r + 5)} ${f(hx - r)},${f(hy - 2)} Z" fill="${it.hairColor || PAPER}" stroke-width="2"/>`;
      if (ch.hair === 'pigtails') {
        head += `<path d="M${f(hx - r + 1)},${f(hy - 6)} q-12,-2 -12,10 q6,-2 10,-4" fill="${it.hairColor || stroke}" stroke-width="2"/><path d="M${f(hx + r - 1)},${f(hy - 6)} q12,-2 12,10 q-6,-2 -10,-4" fill="${it.hairColor || stroke}" stroke-width="2"/>`;
      }
    }
    if (ch.patch) head += `<path d="M${f(hx - r + 2)},${f(hy - 9)} L${f(hx + r - 1)},${f(hy - 3)}" stroke-width="1.6"/><ellipse cx="${f(hx + (side ? r * 0.3 : 0) + r * 0.36)}" cy="${f(hy - r * 0.18)}" rx="4.5" ry="4" fill="${stroke}"/>`;

    // beard & mustache
    if (ch.mustache) {
      const mx = hx + (side ? r * 0.3 : 0), my = hy + r * 0.18;
      head += `<path d="M${f(mx)},${f(my)} q-5,-4 -10,-1 q-3,2 -2,-2 q4,3 12,1 q8,2 12,-1 q1,4 -2,2 q-5,-3 -10,1 z" fill="${it.hairColor || stroke}" stroke-width="1.2"/>`;
    }
    if (ch.beard === 'goatee') {
      const mx = hx + (side ? r * 0.3 : 0);
      head += `<path d="M${f(mx - 4)},${f(hy + r - 2)} L${f(mx)},${f(hy + r + 8)} L${f(mx + 4)},${f(hy + r - 2)} Z" fill="${it.hairColor || '#2d3436'}" stroke-width="1.6"/>`;
    }
    if (ch.beard === 'long') head += `<path d="M${f(hx - r + 3)},${f(hy + 4)} Q${f(hx - 8)},${f(hy + r + 30)} ${f(hx + 4)},${f(hy + r + 38)} Q${f(hx + 4)},${f(hy + r + 20)} ${f(hx + r - 2)},${f(hy + 4)} Q${f(hx)},${f(hy + r - 2)} ${f(hx - r + 3)},${f(hy + 4)} Z" fill="${PAPER}" stroke-width="2.4"/><path d="M${f(hx - 7)},${f(hy + 6)} q7,-4 14,0" stroke-width="2"/>`;
    if (ch.beard === 'short') head += `<path d="M${f(hx - r + 2)},${f(hy + 3)} Q${f(hx - r + 4)},${f(hy + r + 8)} ${f(hx + 2)},${f(hy + r + 6)} Q${f(hx + r)},${f(hy + r + 4)} ${f(hx + r - 1)},${f(hy + 3)} Q${f(hx)},${f(hy + r - 3)} ${f(hx - r + 2)},${f(hy + 3)} Z" fill="${it.hairColor || '#555'}" stroke-width="2"/>`;

    // hats
    const hatT = `translate(${f(hx)},${f(hy)}) rotate(${f(s.lean * 0.4)})`;
    const hat = inner => `<g transform="${hatT}">${inner}</g>`;
    switch (ch.hat) {
      case 'fedora': over += hat(`<path d="M-24,-${r - 3} Q0,-${r + 3} 24,-${r - 3}" stroke-width="3" fill="none"/><path d="M-14,-${r - 1} L-12,-${r + 14} Q0,-${r + 20} 12,-${r + 14} L14,-${r - 1} Z" fill="${it.cloth && ch.hat === 'fedora' ? it.cloth : PAPER}" stroke-width="2.6"/><path d="M-13,-${r + 4} L13,-${r + 4}" stroke-width="3"/>`); break;
      case 'police': over += hat(`<path d="M-16,-${r - 6} L-18,-${r + 8} Q0,-${r + 16} 18,-${r + 8} L16,-${r - 6} Z" fill="#2f5aa8" stroke-width="2.6"/><path d="M-4,-${r - 6} Q10,-${r - 10} 24,-${r - 4}" stroke-width="3.4"/><path transform="translate(0,-${r + 3}) scale(0.5)" d="M0,-8 l2.4,5 5.6,.8 -4,3.9 1,5.5 -5,-2.6 -5,2.6 1,-5.5 -4,-3.9 5.6,-.8z" fill="#ffd23c" stroke-width="2.4"/>`); break;
      case 'crown': over += hat(`<path d="M-13,-${r - 4} L-15,-${r + 14} L-7,-${r + 5} L0,-${r + 16} L7,-${r + 5} L15,-${r + 14} L13,-${r - 4} Z" fill="#ffd23c" stroke-width="2.4"/><circle cx="0" cy="-${r + 1}" r="2" fill="#e74c3c" stroke-width="1"/>`); break;
      case 'tiara': over += hat(`<path d="M-11,-${r - 2} L-8,-${r + 6} L-4,-${r + 1} L0,-${r + 9} L4,-${r + 1} L8,-${r + 6} L11,-${r - 2} Z" fill="#ffd23c" stroke-width="2"/>`); break;
      case 'wizard': over += hat(`<path d="M-26,-${r - 4} Q0,-${r + 2} 26,-${r - 4}" stroke-width="3.2"/><path d="M-15,-${r - 2} Q-4,-${r + 26} 4,-${r + 46} Q14,-${r + 50} 18,-${r + 40} Q10,-${r + 36} 15,-${r - 2} Z" fill="${it.cloth || '#6c5ce7'}" stroke-width="2.6"/><path transform="translate(1,-${r + 16}) scale(0.6)" d="M0,-8 l2.4,5 5.6,.8 -4,3.9 1,5.5 -5,-2.6 -5,2.6 1,-5.5 -4,-3.9 5.6,-.8z" fill="#ffd23c" stroke-width="2.4"/>`); break;
      case 'chef': over += hat(`<path d="M-12,-${r - 3} L-12,-${r + 8} Q-22,-${r + 14} -14,-${r + 22} Q-8,-${r + 32} 0,-${r + 25} Q8,-${r + 32} 14,-${r + 22} Q22,-${r + 14} 12,-${r + 8} L12,-${r - 3} Z" fill="${PAPER}" stroke-width="2.4"/><line x1="-12" y1="-${r + 2}" x2="12" y2="-${r + 2}" stroke-width="2"/>`); break;
      case 'pirate': over += hat(`<path d="M-26,-${r - 6} Q-20,-${r + 20} 0,-${r + 12} Q20,-${r + 20} 26,-${r - 6} Q0,-${r + 2} -26,-${r - 6} Z" fill="#2d3436" stroke-width="2.4"/><circle cx="0" cy="-${r + 2}" r="3.2" fill="${PAPER}" stroke="${PAPER}" stroke-width="0"/>`); break;
      case 'helmet': over += hat(`<path d="M-${r + 2},4 Q-${r + 3},-${r + 4} 0,-${r + 3} Q${r + 3},-${r + 4} ${r + 2},4 L${r + 2},-3 L-${r + 2},-3 Z" fill="${it.cloth || '#dfe6e9'}" stroke-width="2.6"/><rect x="-${r + 2}" y="-3" width="${2 * r + 4}" height="${f(r * 0.45)}" fill="${stroke}" stroke-width="1"/><circle cx="${side ? 4 : -6}" cy="${f(-3 + r * 0.22)}" r="1.8" fill="${PAPER}" stroke="none"/><circle cx="${side ? 12 : 6}" cy="${f(-3 + r * 0.22)}" r="1.8" fill="${PAPER}" stroke="none"/><path d="M0,-${r + 3} Q-10,-${r + 18} -22,-${r + 10} Q-12,-${r + 12} -8,-${r + 2}" fill="#e74c3c" stroke-width="2"/><line x1="0" y1="-${r + 3}" x2="0" y2="-4" stroke-width="1.6"/>`); break;
      case 'astro': over += hat(`<circle cx="0" cy="0" r="${r + 7}" fill="#e6f3ff" fill-opacity="0.22" stroke-width="2.6"/><path d="M-${r + 3},${r + 4} Q0,${r + 9} ${r + 3},${r + 4}" stroke-width="3.2"/><path d="M-${r + 1},-${r - 2} Q-${r - 3},-${r + 3} -${r - 7},-${r + 1}" stroke="${PAPER}" stroke-width="2.2"/>`); break;
      case 'antenna': over += hat(`<line x1="-6" y1="-${r - 1}" x2="-11" y2="-${r + 13}" stroke-width="2.2"/><circle cx="-11" cy="-${r + 15}" r="3" fill="#2ecc71" stroke-width="1.8"/><line x1="6" y1="-${r - 1}" x2="11" y2="-${r + 13}" stroke-width="2.2"/><circle cx="11" cy="-${r + 15}" r="3" fill="#2ecc71" stroke-width="1.8"/>`); break;
      case 'cowboy': over += hat(`<path d="M-26,-${r - 2} Q-16,-${r - 8} -12,-${r - 4} L12,-${r - 4} Q16,-${r - 8} 26,-${r - 2}" stroke-width="3" fill="none"/><path d="M-13,-${r - 3} L-10,-${r + 15} Q-4,-${r + 12} 0,-${r + 15} Q4,-${r + 12} 10,-${r + 15} L13,-${r - 3} Z" fill="${it.cloth || '#c89d6c'}" stroke-width="2.4"/><path d="M-12,-${r + 2} L12,-${r + 2}" stroke-width="2.6"/>`); break;
      case 'deerstalker': over += hat(`<path d="M-16,-${r - 4} Q-14,-${r + 14} 0,-${r + 14} Q14,-${r + 14} 16,-${r - 4} Z" fill="${it.cloth || '#a0826d'}" stroke-width="2.4"/><path d="M-22,-${r - 3} Q-14,-${r - 7} -10,-${r - 4} M10,-${r - 4} Q14,-${r - 7} 22,-${r - 3}" stroke-width="3"/>`); break;
      case 'witch': over += hat(`<path d="M-26,-${r - 4} Q0,-${r + 2} 26,-${r - 4}" stroke-width="3.2"/><path d="M-14,-${r - 2} Q-4,-${r + 26} 3,-${r + 42} Q8,-${r + 24} 14,-${r - 2} Z" fill="${it.cloth || '#2d3436'}" stroke-width="2.6"/><rect x="-7" y="-${r + 5}" width="14" height="5" fill="#ffd23c" stroke-width="1.4"/>`); break;
      case 'halo': over += hat(`<ellipse cx="0" cy="-${r + 11}" rx="13" ry="4" fill="none" stroke="#f1c40f" stroke-width="2.8"/>`); break;
      case 'horns': over += hat(`<path d="M-9,-${r - 3} Q-16,-${r + 14} -6,-${r + 17} Q-10,-${r + 8} -5,-${r - 1} Z" fill="#c0392b" stroke-width="2"/><path d="M9,-${r - 3} Q16,-${r + 14} 6,-${r + 17} Q10,-${r + 8} 5,-${r - 1} Z" fill="#c0392b" stroke-width="2"/>`); break;
      case 'beret': over += hat(`<path d="M-17,-${r - 4} Q-18,-${r + 15} 2,-${r + 14} Q18,-${r + 13} 15,-${r - 4} Z" fill="${it.cloth || '#c0392b'}" stroke-width="2.4"/><line x1="-2" y1="-${r + 14}" x2="-1" y2="-${r + 18}" stroke-width="2.4"/>`); break;
      case 'grad': over += hat(`<path d="M-13,-${r - 4} L-13,-${r + 6} L13,-${r + 6} L13,-${r - 4} Z" fill="${it.cloth || '#2d3436'}" stroke-width="2.2"/><path d="M-22,-${r + 7} L0,-${r + 13} L22,-${r + 7} L0,-${r + 1} Z" fill="${it.cloth || '#2d3436'}" stroke-width="2.2"/><path d="M14,-${r + 6} L18,-${r - 4}" stroke="#ffd23c" stroke-width="2.2"/><circle cx="18" cy="-${r - 5}" r="2.2" fill="#ffd23c" stroke="none"/>`); break;
      case 'cap': over += hat(`<path d="M-15,-${r - 4} A15,15 0 0 1 15,-${r - 4} Z" fill="${it.cloth || '#e74c3c'}" stroke-width="2.4"/><path d="M-2,-${r - 4} Q12,-${r - 7} 23,-${r - 2}" stroke-width="3.2"/>`); break;
      case 'tophat': over += hat(`<path d="M-22,-${r - 3} L22,-${r - 3}" stroke-width="3.2"/><path d="M-13,-${r - 3} L-14,-${r + 22} L14,-${r + 22} L13,-${r - 3} Z" fill="${it.cloth || '#2d3436'}" stroke-width="2.4"/><line x1="-13" y1="-${r + 3}" x2="13" y2="-${r + 3}" stroke="#c0392b" stroke-width="3"/>`); break;
    }

    const fxList = (it.fx || []).slice();
    const fxSvg = effects(fxList, s, r, stroke, it.flipX);

    const scale = ch.scale || 1;
    const inner = back + body + front + head + over + fxSvg;
    return `<g transform="translate(${NW / 2},${GROUND}) scale(${scale}) translate(0,0)" fill="none" stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
  }

  // head centre in native box coordinates (used for face thumbnails)
  function headAt(char, pose) {
    const ch = CHARACTERS[char] || CHARACTERS.boy;
    const s = skeleton(POSES[pose] || POSES.stand, PROPORTIONS[ch.prop]);
    const k = ch.scale || 1;
    return [NW / 2 + s.headC[0] * k, GROUND + s.headC[1] * k, PROPORTIONS[ch.prop].head * k];
  }
  // hip position in native box coordinates (used to seat figures on chairs)
  function hipAt(char, pose) {
    const ch = CHARACTERS[char] || CHARACTERS.boy;
    const s = skeleton(POSES[pose] || POSES.stand, PROPORTIONS[ch.prop]);
    const k = ch.scale || 1;
    return [NW / 2 + s.hip[0] * k, GROUND + s.hip[1] * k];
  }

  window.FIG = { NW, NH, GROUND, POSES, CHARACTERS, EXPRESSIONS, FX, HAND_ITEMS, draw: drawFigure, headAt, hipAt };
})();
