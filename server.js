// ... 前面代码保持不变 ...

const total = stats.rows[0].b || 0;

res.send(getLayout(`
    <div class="header">
        <div style="display:flex; flex-direction:column; align-items:center;">
            <div class="supply-tag" id="header-title">EXCHANGE RESERVE: ${total.toLocaleString()} COIN</div>
            <div id="live-clock" style="font-size:10px; color:#666; margin-top:5px; font-family:'Roboto Mono'; letter-spacing:1px;"></div>
        </div>
    </div>
    <div class="container">
        <div class="visual"><canvas id="g"></canvas></div>
        <div class="sidebar">
            </div>
    </div>
    <script>
        // --- 粒子球代码保持不变 ---
        const c=document.getElementById('g'), x=c.getContext('2d'); let w,h,pts=[];
        function res(){ w=c.width=c.parentElement.offsetWidth; h=c.height=c.parentElement.offsetHeight; pts=[]; for(let i=0;i<450;i++){ let t=Math.random()*6.28, a=Math.acos(Math.random()*2-1); pts.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } }
        let r=0; function draw(){ x.fillStyle='#050505'; x.fillRect(0,0,w,h); r+=0.0035; x.save(); x.translate(w/2,h/2); pts.forEach(p=>{ let x1=p.x*Math.cos(r)-p.z*Math.sin(r), z1=p.z*Math.cos(r)+p.x*Math.sin(r); let s=(z1+1.2)/2.4; x.fillStyle="rgba(240,185,11,"+s+")"; x.beginPath(); x.arc(x1*Math.min(w,h)*0.38,p.y*Math.min(w,h)*0.38,s*1.6,0,7); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
        window.onresize=res; res(); draw();

        // --- 新增：实时时钟逻辑 ---
        function updateClock() {
            const now = new Date();
            const options = { 
                year: 'numeric', month: 'short', day: '2-digit', 
                hour: '2-digit', minute: '2-digit', second: '2-digit', 
                hour12: false 
            };
            // 按照马来西亚习惯或通用格式显示：APR 06, 2026 03:45:12
            document.getElementById('live-clock').innerText = now.toLocaleString('en-US', options).toUpperCase();
        }
        setInterval(updateClock, 1000);
        updateClock();

        // --- 原有功能函数保持不变 ---
        function sw(m){ document.getElementById('box-tx').style.display=m==='tx'?'block':'none'; document.getElementById('box-rg').style.display=m==='rg'?'block':'none'; document.getElementById('t1').className=m==='tx'?'tab-btn active':'tab-btn'; document.getElementById('t2').className=m==='rg'?'tab-btn active':'tab-btn'; }
        function reg(){ const n=document.getElementById('rn').value, p=document.getElementById('rp').value; if(n&&p) location.href='/api/reg?u='+encodeURIComponent(n)+'&p='+p; }
        function send(){ const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; if(f&&p&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&p='+p+'&t='+encodeURIComponent(t)+'&a='+a; }
        function check(){ const n=prompt("ENTER ID:"); if(n) location.href='/api/bal?u='+encodeURIComponent(n); }
    </script>
`));
