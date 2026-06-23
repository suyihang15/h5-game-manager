/**
 * Login Page - renders full-screen over the app layout.
 */
const LoginPage = {
    render(container) {
        // Hide sidebar + topbar, remove content padding so login fills window
        var sidebar = document.getElementById('sidebar');
        var topbar = document.querySelector('.top-bar');
        if (sidebar) sidebar.style.display = 'none';
        if (topbar) topbar.style.display = 'none';
        container.style.padding = '0';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.minHeight = '100vh';

        container.innerHTML = ''
            + '<div class="login-page">'
            + '  <div class="login-card">'
            + '    <div class="login-logo">'
            + '      <div class="logo-icon"><i class="bi bi-controller"></i></div>'
            + '      <h2 class="login-title">H5游戏管理器</h2>'
            + '      <p class="login-subtitle">登录以管理你的游戏项目</p>'
            + '    </div>'
            + '    <form id="loginForm" onsubmit="return false">'
            + '      <div class="mb-3"><label class="form-label">用户名</label><div class="input-group"><span class="input-group-text"><i class="bi bi-person"></i></span><input class="form-control" id="loginUser" placeholder="用户名" autofocus></div></div>'
            + '      <div class="mb-3"><label class="form-label">密码</label><div class="input-group"><span class="input-group-text"><i class="bi bi-lock"></i></span><input type="password" class="form-control" id="loginPass" placeholder="密码"></div></div>'
            + '      <div id="loginErr" class="alert alert-danger d-none py-2"></div>'
            + '      <button type="submit" class="btn btn-primary w-100 mt-2" id="loginBtn"><span id="loginBtnText">登 录</span><span id="loginBtnSpin" class="spinner-border spinner-border-sm d-none"></span></button>'
            + '    </form>'
            + '    <p class="text-center mt-3 mb-0" style="font-size:12px;color:var(--text-muted)">默认: admin / admin123</p>'
            + '  </div>'
            + '</div>';

        var err = document.getElementById('loginErr');
        var bt = document.getElementById('loginBtnText');
        var sp = document.getElementById('loginBtnSpin');

        document.getElementById('loginForm').addEventListener('submit', async function() {
            var u = document.getElementById('loginUser').value.trim();
            var p = document.getElementById('loginPass').value.trim();
            if (!u || !p) { err.textContent = '请输入用户名和密码'; err.classList.remove('d-none'); return; }
            err.classList.add('d-none'); bt.classList.add('d-none'); sp.classList.remove('d-none');
            try {
                await App.login(u, p);
                if (sidebar) sidebar.style.display = '';
                if (topbar) topbar.style.display = '';
                container.style.padding = '';
                container.style.display = '';
                container.style.alignItems = '';
                container.style.justifyContent = '';
                container.style.minHeight = '';
            } catch (e) {
                err.textContent = e.message || '登录失败';
                err.classList.remove('d-none');
                bt.classList.remove('d-none');
                sp.classList.add('d-none');
            }
        });

        document.getElementById('loginUser').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('loginForm').dispatchEvent(new Event('submit')); });
        document.getElementById('loginPass').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('loginForm').dispatchEvent(new Event('submit')); });
    }
};
