const form = document.getElementById('contactForm');
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.classList.add('was-validated'); return; }
    form.classList.add('was-validated');
    document.getElementById('formOk').classList.remove('d-none');
    setTimeout(() => { form.reset(); form.classList.remove('was-validated'); document.getElementById('formOk').classList.add('d-none'); }, 4000);
  });
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
    });
  });


  /* ══ CANVAS RADAR ══ */
  (function() {
    const canvas = document.getElementById('radarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2, R = W / 2 - 10;
    let angle = 0;

    // Fixed "blip" targets
    const blips = [
      { r: 0.45, a: 0.8,  life: 1 },
      { r: 0.72, a: 2.1,  life: 0.6 },
      { r: 0.31, a: 3.9,  life: 0.8 },
      { r: 0.61, a: 5.1,  life: 0.4 },
      { r: 0.55, a: 1.3,  life: 0 },
      { r: 0.83, a: 4.6,  life: 0 },
      { r: 0.25, a: 0.2,  life: 0 },
    ];

    function drawRadar() {
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#080c0e';
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Rings
      [0.25, 0.5, 0.75, 1].forEach(f => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,255,136,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Cross-hairs
      ctx.strokeStyle = 'rgba(0,255,136,0.12)';
      ctx.lineWidth = 1;
      [[cx, cy - R, cx, cy + R], [cx - R, cy, cx + R, cy]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });

      // Sweep gradient
      const sweepGrad = ctx.createConicalGradient
        ? null
        : null;
      // Draw sweep arc (filled pie slice with alpha fade)
      const sweepRange = Math.PI / 2;
      for (let i = 0; i < 60; i++) {
        const a = angle - (i / 60) * sweepRange;
        const alpha = (1 - i / 60) * 0.3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R - 1, a, a + sweepRange / 60);
        ctx.closePath();
        ctx.fillStyle = `rgba(0,255,136,${alpha})`;
        ctx.fill();
      }

      // Sweep line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * R, cy + Math.sin(angle) * R);
      ctx.strokeStyle = 'rgba(0,255,136,0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Blips
      blips.forEach(b => {
        const diff = ((angle - b.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (diff < 0.05) { b.life = 1; }
        if (b.life > 0) {
          const bx = cx + Math.cos(b.a) * R * b.r;
          const by = cy + Math.sin(b.a) * R * b.r;
          ctx.beginPath();
          ctx.arc(bx, by, 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,255,136,${b.life})`;
          ctx.fill();
          // glow ring
          ctx.beginPath();
          ctx.arc(bx, by, 8, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0,255,136,${b.life * 0.4})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          b.life -= 0.004;
        }
      });

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff88';
      ctx.fill();

      // Border clip
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,255,136,0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      angle += 0.018;
      if (angle > Math.PI * 2) angle -= Math.PI * 2;
      requestAnimationFrame(drawRadar);
    }
    drawRadar();
  })();
// Auth nav init
document.addEventListener('DOMContentLoaded', () => { if(typeof updateNavAuth==='function') updateNavAuth(); });
