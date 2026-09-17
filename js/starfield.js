/**
 * starfield.js
 * Draws the faint animated star background used across every view.
 */

/* ---------- ambient starfield ---------- */
(function() {
  const c = document.getElementById('bg-stars'),
    ctx = c.getContext('2d');
  let w, h, stars = [];

  function resize() {
    w = c.width = window.innerWidth;
    h = c.height = document.documentElement.scrollHeight;
    stars = Array.from({
      length: 140
    }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.3 + .3,
      tw: Math.random() * Math.PI * 2
    }));
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    stars.forEach(s => {
      const a = .35 + .4 * Math.abs(Math.sin(t / 1400 + s.tw));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 7);
      ctx.fillStyle = `rgba(238,241,250,${a})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(draw);
})();
