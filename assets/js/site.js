/* Quantum AI — shared behaviour for every page. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const markLoaded = () => document.documentElement.classList.add('is-loaded');
  requestAnimationFrame(markLoaded); setTimeout(markLoaded, 300);

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const t = id.length > 1 && document.querySelector(id);
    if (!t) return;
    e.preventDefault();
    lenis ? lenis.scrollTo(t, { offset: -90 }) : t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }));

  /* ---------- nav ---------- */
  const nav = $('#nav');
  const darkZones = () => $$('.block--dark, .cta-band, .footer, [data-dark]');
  const burger = $('.nav__burger'), mobile = $('#mobile-menu');
  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mobile.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (lenis) open ? lenis.stop() : lenis.start();
    nav.classList.toggle('is-dark', false);
  });
  $$('.has-menu').forEach(li => {
    const btn = $('.nav__link', li);
    let timer;
    const set = open => { open ? li.setAttribute('data-open', '') : li.removeAttribute('data-open'); btn.setAttribute('aria-expanded', open); };
    btn.addEventListener('click', () => set(!li.hasAttribute('data-open')));
    li.addEventListener('mouseenter', () => { clearTimeout(timer); set(true); });
    li.addEventListener('mouseleave', () => { timer = setTimeout(() => set(false), 160); });
    li.addEventListener('focusout', e => { if (!li.contains(e.relatedTarget)) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { set(false); } });
  });

  /* ---------- reveals ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach(el => io.observe(el));

  /* ---------- live interference fields (WebGL) ---------- */
  const VARIANTS = {
    home: { bg: [.933, .941, .969], a: [.357, .239, .961], b: [0, .655, .741], line: [.043, .063, .2], amp: .92, calm: 1, k: 46, mouse: 1 },
    calm: { bg: [.933, .941, .969], a: [.357, .239, .961], b: [0, .655, .741], line: [.043, .063, .2], amp: .62, calm: 1, k: 40, mouse: 1 },
    cta:  { bg: [.043, .063, .2], a: [.545, .463, 1], b: [0, .655, .741], line: [.933, .941, .969], amp: .55, calm: 1, k: 34, mouse: 1 },
  };
  const FS = `precision highp float;
    uniform vec2 r; uniform float t; uniform vec2 m; uniform float s;
    uniform vec3 bg, ca, cb, cl; uniform float amp, calm, k0;
    void main(){
      vec2 uv=(gl_FragCoord.xy-.5*r)/min(r.x,r.y);
      float k=k0+s*36.;
      vec2 a=vec2(-.62,.32+.06*sin(t*.31)), c=vec2(.78,-.36+.05*cos(t*.23));
      float da=length(uv-a), db=length(uv-m), dc=length(uv-c);
      float w=sin(k*da-t*1.5)/(1.+da*1.2)+sin(k*db-t*1.5)/(1.+db*1.2)+.7*sin(k*.82*dc-t*1.1)/(1.+dc*1.2);
      w/=1.9;
      vec2 q=gl_FragCoord.xy/r;
      float quiet=mix(1.,smoothstep(.12,.68,q.x+.18*q.y),calm);
      float A=mix(.1,1.,quiet)*amp;
      vec3 col=bg;
      col=mix(col,ca,smoothstep(.15,.95,w)*A*.66);
      col=mix(col,cb,smoothstep(.15,.95,-w)*A*.42);
      col=mix(col,cl,(1.-smoothstep(0.,.035,abs(w)))*.1*A);
      gl_FragColor=vec4(col,1.);
    }`;
  const pointer = { x: 0, y: 0, has: false };
  addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.has = true; }, { passive: true });

  function startField(canvas) {
    const v = VARIANTS[canvas.dataset.field] || VARIANTS.calm;
    const gl = canvas.getContext('webgl', { antialias: false });
    if (!gl) return;
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(pr, n);
    gl.uniform3fv(U('bg'), v.bg); gl.uniform3fv(U('ca'), v.a); gl.uniform3fv(U('cb'), v.b); gl.uniform3fv(U('cl'), v.line);
    gl.uniform1f(U('amp'), v.amp); gl.uniform1f(U('calm'), v.calm); gl.uniform1f(U('k0'), v.k);
    const ur = U('r'), ut = U('t'), um = U('m'), us = U('s');
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, canvas.clientWidth * dpr); canvas.height = Math.max(1, canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize(); addEventListener('resize', resize);
    const m = { x: .3, y: .1 };
    let visible = true, t0 = performance.now();
    const draw = now => {
      const t = reduce ? 4 : (now - t0) / 1000;
      const rc = canvas.getBoundingClientRect(), mn = Math.min(rc.width, rc.height);
      if (pointer.has && v.mouse) {
        const tx = (pointer.x - rc.left - rc.width / 2) / mn, ty = -(pointer.y - rc.top - rc.height / 2) / mn;
        m.x += (tx - m.x) * .06; m.y += (ty - m.y) * .06;
      }
      const drift = reduce ? 0 : .05;
      gl.uniform2f(ur, canvas.width, canvas.height); gl.uniform1f(ut, t);
      gl.uniform2f(um, m.x + drift * Math.sin(t * .5), m.y + drift * Math.cos(t * .4));
      gl.uniform1f(us, Math.min(1, Math.max(0, -rc.top / Math.max(1, rc.height))));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && reduce) draw(0); }).observe(canvas);
    if (reduce) { draw(0); addEventListener('resize', () => draw(0)); return; }
    const loop = now => { if (visible) draw(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  // Sections marked data-field without their own canvas get one.
  $$('section[data-field]').forEach(sec => {
    if ($('canvas.field', sec)) return;
    const c = document.createElement('canvas');
    c.className = 'field'; c.dataset.field = sec.dataset.field; c.setAttribute('aria-hidden', 'true');
    sec.prepend(c);
  });
  $$('canvas.field').forEach(startField);

  /* ---------- static interference art (cards, sector panels) ---------- */
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function paintArt(canvas) {
    const W = 360, H = 225;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
    const R = rng(+canvas.dataset.art || 7);
    const n = 2 + Math.floor(R() * 2);
    const src = Array.from({ length: n }, () => [R() * W, R() * H, 0.06 + R() * 0.07]);
    const ink = [11, 16, 51], vio = [139, 118, 255], cy = [0, 167, 189];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let w = 0;
      for (const [sx, sy, k] of src) { const r = Math.hypot(x - sx, y - sy); w += Math.sin(r * k) / (1 + r * .006); }
      w /= n * .8;
      const p = Math.max(0, Math.min(1, (w - .15) / .8)), q = Math.max(0, Math.min(1, (-w - .15) / .8));
      const fr = Math.max(0, 1 - Math.abs(w) / .04) * .25;
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        let v = ink[c] + (vio[c] - ink[c]) * p * .75;
        v += (cy[c] - v) * q * .5;
        v += (238 - v) * fr;
        d[i + c] = v;
      }
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  const artIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { paintArt(e.target); artIO.unobserve(e.target); } }), { rootMargin: '200px' });
  $$('canvas[data-art]').forEach(c => artIO.observe(c));

  /* ---------- statement words light up on scroll ---------- */
  const statement = $('[data-words]');
  let words = [];
  if (statement) {
    const html = statement.innerHTML.replace(/<em>(.*?)<\/em>/g, (_, w) => w.split(' ').map(x => '§' + x).join(' '));
    statement.innerHTML = html.split(/(\s+)/).map(w => /^\s+$/.test(w) || !w ? w :
      `<span class="w${w.startsWith('§') ? ' w--accent' : ''}">${w.replace('§', '')}</span>`).join('');
    words = $$('.w', statement);
  }

  /* ---------- horizontal pinned track ---------- */
  const pin = $('.pin'), track = $('.track'), bar = $('.progress b');
  const horiz = () => !reduce && matchMedia('(min-width: 821px)').matches;

  /* ---------- toc highlighting ---------- */
  const tocLinks = $$('.toc a');
  const tocTargets = tocLinks.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);

  const onScroll = () => {
    const y = scrollY, vh = innerHeight;
    nav.classList.toggle('is-scrolled', y > 30);
    if (burger.getAttribute('aria-expanded') !== 'true') {
      const probe = 36;
      nav.classList.toggle('is-dark', darkZones().some(z => { const r = z.getBoundingClientRect(); return r.top <= probe && r.bottom > probe; }));
    }
    if (pin && track) {
      if (horiz()) {
        const pr = pin.getBoundingClientRect(), total = pin.offsetHeight - vh;
        const p = Math.min(1, Math.max(0, -pr.top / total));
        const last = track.lastElementChild, gut = parseFloat(getComputedStyle(track).paddingLeft);
        const max = Math.max(0, last.offsetLeft + last.offsetWidth + gut - innerWidth);
        track.style.transform = `translate3d(${-p * max}px,0,0)`;
        if (bar) bar.style.width = (p * 100) + '%';
      } else track.style.transform = '';
    }
    if (words.length) {
      const br = statement.getBoundingClientRect();
      const wp = Math.min(1, Math.max(0, (vh * .85 - br.top) / (br.height + vh * .35)));
      const lit = Math.round(wp * words.length);
      words.forEach((w, i) => w.classList.toggle('is-lit', reduce || i < lit));
    }
    if (tocTargets.length) {
      let cur = tocTargets[0];
      tocTargets.forEach(t => { if (t.getBoundingClientRect().top < vh * .3) cur = t; });
      tocLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + cur.id));
    }
  };
  if (lenis) lenis.on('scroll', onScroll);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ---------- tabs (model ladder, sector explorer) ---------- */
  $$('[role="tablist"]').forEach(list => {
    const tabs = $$('[role="tab"]', list);
    const select = (tab, focus) => {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) {
          panel.hidden = !on;
          if (on) { panel.classList.remove('is-entering'); void panel.offsetWidth; panel.classList.add('is-entering'); $$('canvas[data-art]', panel).forEach(paintArt); }
        }
      });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', e => {
        const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (dir) { e.preventDefault(); select(tabs[(i + dir + tabs.length) % tabs.length], true); }
      });
    });
  });

  // A link like /industries#healthcare opens that sector's tab.
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    const tab = target && target.getAttribute('role') === 'tabpanel' && document.querySelector(`[aria-controls="${target.id}"]`);
    if (tab) tab.click();
  }

  /* ---------- AI readiness check ---------- */
  const quiz = $('#quiz');
  if (quiz) {
    const sets = $$('fieldset', quiz), meter = $('.quiz__meter i'), count = $('.quiz__count');
    const back = $('[data-quiz="back"]', quiz), next = $('[data-quiz="next"]', quiz), result = $('.quiz__result'), nav2 = $('.quiz__nav', quiz);
    const out = $('#quiz-out');
    let i = 0;
    const show = () => {
      sets.forEach((s, j) => s.hidden = j !== i);
      meter.style.width = ((i) / sets.length * 100) + '%';
      count.textContent = `Question ${i + 1} of ${sets.length}`;
      back.disabled = i === 0;
      next.textContent = i === sets.length - 1 ? 'See my result' : 'Next question';
    };
    const BANDS = [
      { max: 4, title: 'Start with the foundations', text: 'AI can help you, but the groundwork comes first: a clear priority, accessible data and someone who owns the outcome. A readiness assessment will show you what to fix first and what you can already do.', cta: 'Ask about a readiness assessment' },
      { max: 8, title: 'Ready for a focused pilot', text: 'You have enough in place to prove value on one well-chosen use case. A two-to-four-week discovery sprint will pick that use case, check the data and give you a working prototype plan.', cta: 'Ask about a discovery sprint' },
      { max: 12, title: 'Ready to build and scale', text: 'You have the data, ownership and appetite to build properly. The next step is production-grade solutions, and possibly custom models where off-the-shelf AI falls short.', cta: 'Talk to us about a build' },
    ];
    next.addEventListener('click', () => {
      if (!$('input:checked', sets[i])) { count.textContent = 'Pick an answer to continue.'; return; }
      if (i < sets.length - 1) { i++; show(); return; }
      const score = sets.reduce((a, s) => a + +$('input:checked', s).value, 0);
      const band = BANDS.find(b => score <= b.max);
      sets.forEach(s => s.hidden = true); nav2.hidden = true; meter.style.width = '100%'; count.textContent = 'Complete';
      out.innerHTML = `<p class="mono">Your score</p><p class="score">${score}<span style="font-size:.35em;opacity:.5"> / 12</span></p><h3 class="h3">${band.title}</h3><p>${band.text}</p><div class="btns"><a class="btn btn--light" href="/contact?topic=consulting">${band.cta}</a><button class="btn btn--line-light" type="button" data-quiz="restart">Start again</button></div>`;
      result.hidden = false;
      $('[data-quiz="restart"]', out).addEventListener('click', () => { quiz.reset(); i = 0; result.hidden = true; nav2.hidden = false; show(); });
    });
    back.addEventListener('click', () => { if (i > 0) { i--; show(); } });
    show();
  }

  /* ---------- contact form ---------- */
  const form = $('#contact-form');
  if (form) {
    const status = $('.form__status', form);
    const topic = new URLSearchParams(location.search).get('topic');
    if (topic) { const box = $(`input[name="interest"][value="${topic}"]`, form); if (box) box.checked = true; }
    form.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(form);
      const need = { name: 'your name', email: 'your email', message: 'a short description of the problem' };
      const missing = Object.keys(need).filter(k => !String(fd.get(k) || '').trim());
      $$('input, textarea', form).forEach(f => f.removeAttribute('aria-invalid'));
      missing.forEach(k => form.elements[k].setAttribute('aria-invalid', 'true'));
      if (missing.length) { status.className = 'form__status is-error'; status.textContent = 'Add ' + missing.map(k => need[k]).join(', ') + ' so we can reply.'; form.elements[missing[0]].focus(); return; }
      if (!/^\S+@\S+\.\S+$/.test(fd.get('email'))) { form.elements.email.setAttribute('aria-invalid', 'true'); status.className = 'form__status is-error'; status.textContent = 'Check your email address. It looks incomplete.'; return; }
      const interests = fd.getAll('interest').join(', ') || 'Not specified';
      const body = [`Name: ${fd.get('name')}`, `Email: ${fd.get('email')}`, `Company: ${fd.get('company') || '-'}`, `Interested in: ${interests}`, `Timeline: ${fd.get('timeline')}`, '', fd.get('message')].join('\n');
      location.href = `mailto:roopa@quantumailtd.co.uk?subject=${encodeURIComponent('Website enquiry from ' + fd.get('name'))}&body=${encodeURIComponent(body)}`;
      status.className = 'form__status is-ok';
      status.textContent = 'Your email app should now open with the message ready to send. If it doesn’t, email roopa@quantumailtd.co.uk directly.';
    });
  }

  /* ---------- insights filter ---------- */
  const filters = $$('[data-filter]');
  filters.forEach(b => b.addEventListener('click', () => {
    const f = b.dataset.filter;
    filters.forEach(x => x.setAttribute('aria-pressed', x === b));
    $$('[data-topic]').forEach(p => p.hidden = f !== 'all' && p.dataset.topic !== f);
  }));
})();
