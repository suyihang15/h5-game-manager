/**
 * Main App - Router, Auth, Global state.
 * Zero dependencies on Eel bridge.
 */
const App = (() => {
    const ROUTES = {
        '/':           { title: '仪表盘',     render: 'dashboard', auth: true },
        '/login':      { title: '登录',       render: 'login',     auth: false },
        '/games':      { title: '游戏管理',   render: 'gamesList', auth: true },
        '/games/new':  { title: '添加游戏',   render: 'gamesForm', auth: true },
        '/categories': { title: '分类管理',   render: 'categories',auth: true },
        '/users':      { title: '用户管理',   render: 'users',     auth: true },
        '/settings':   { title: '系统设置',   render: 'settings',  auth: true },
    };

    const RENDERERS = {
        dashboard:   (el) => DashboardPage.render(el),
        login:       (el) => LoginPage.render(el),
        gamesList:   (el) => GamesPage.renderList(el),
        gamesForm:   (el) => GamesPage.renderForm(el),
        categories:  (el) => CategoriesPage.render(el),
        users:       (el) => UsersPage.render(el),
        settings:    (el) => SettingsPage.render(el),
    };

    // Dynamic: /games/<slug>/edit
    function matchDynamic(hash) {
        const m = hash.match(/^#\/games\/([^/]+)\/edit$/);
        if (m) return { title: '编辑游戏', render: (el) => GamesPage.renderForm(el, m[1]), auth: true };
        return null;
    }

    let user = null;

    async function init() {
        // Restore session
        const token = API.getToken();
        if (token) {
            try {
                const data = await API.get('/api/auth/verify');
                if (data && data.user) { user = data.user; updateSidebar(); }
                else { API.setToken(null); }
            } catch (e) { API.setToken(null); }
        }
        window.addEventListener('hashchange', route);
        route();
    }

    function route() {
        const hash = window.location.hash.slice(1) || '/';
        const area = document.getElementById('contentArea');
        const titEl = document.getElementById('pageTitle');
        const addBtn = document.getElementById('btnQuickAdd');

        if (!area) { console.log('ERROR: contentArea not found'); return; }

        // Match route
        let r = ROUTES[hash];
        if (!r) {
            const dyn = matchDynamic('#' + hash);
            if (dyn) r = dyn;
        }
        if (!r) { window.location.hash = '#/'; return; }

        // Auth
        if (r.auth !== false && !user) { window.location.hash = '#/login'; return; }
        if (hash === '/login' && user)   { window.location.hash = '#/'; return; }

        // Update chrome
        if (titEl) titEl.textContent = r.title;
        document.title = r.title + ' - H5游戏管理器';
        if (addBtn) addBtn.style.display = (hash === '/games' || hash === '/') ? '' : 'none';

        // Highlight nav
        try {
            document.querySelectorAll('.nav-item').forEach(el => {
                const rt = el.getAttribute('data-route');
                el.classList.toggle('active', rt && hash.startsWith(rt) && (rt !== '/' || hash === '/'));
            });
        } catch(e) {}

        // Show spinner
        area.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-secondary">加载中...</p></div>';

        // Render
        try {
            const fn = typeof r.render === 'function' ? r.render : RENDERERS[r.render];
            if (fn) fn(area);
            else area.innerHTML = '<div class="empty-state"><h3>页面未找到</h3></div>';
        } catch (e) {
            console.log('Render error:', e);
            area.innerHTML = '<div class="empty-state"><h3>页面加载出错</h3><p>' + (e.message || '未知错误') + '</p><button class="btn btn-primary mt-3" onclick="App.navigate(\'#/\')">返回首页</button></div>';
        }
    }

    async function login(username, password) {
        const data = await API.post('/api/auth/login', { username: username, password: password });
        if (data && data.token) {
            API.setToken(data.token);
            user = data.user;
            updateSidebar();
            window.location.hash = '#/';
        }
        return data;
    }

    function logout() { API.setToken(null); user = null; window.location.hash = '#/login'; }

    function updateSidebar() {
        const u = document.getElementById('currentUsername');
        const r = document.getElementById('currentUserRole');
        if (u && user) u.textContent = user.username;
        if (r && user) {
            r.textContent = user.role === 'superadmin' ? '超级管理员' : '管理员';
            r.className = 'user-role badge ' + (user.role === 'superadmin' ? 'bg-warning' : 'bg-secondary');
        }
    }

    function showToast(msg, type) {
        type = type || 'success';
        const ct = document.getElementById('toastContainer');
        if (!ct) return;
        const icons = { success: 'bi-check-circle-fill text-success', error: 'bi-x-circle-fill text-danger', warning: 'bi-exclamation-triangle-fill text-warning', info: 'bi-info-circle-fill text-info' };
        const id = 't' + Date.now();
        ct.insertAdjacentHTML('beforeend', '<div id="' + id + '" class="toast align-items-center border-0"><div class="toast-header"><i class="bi ' + (icons[type] || icons.info) + ' me-2"></i><strong class="me-auto">' + (type === 'error' ? '错误' : type === 'warning' ? '警告' : '提示') + '</strong><button type="button" class="btn-close" data-bs-dismiss="toast"></button></div><div class="toast-body">' + msg + '</div></div>');
        const el = document.getElementById(id);
        const toast = new bootstrap.Toast(el, { delay: 3000 });
        toast.show();
        el.addEventListener('hidden.bs.toast', function() { el.remove(); });
    }

    function confirm(title, msg, onOk) {
        var modal = document.getElementById('confirmModal');
        if (!modal) {
            document.body.insertAdjacentHTML('beforeend', '<div class="modal fade" id="confirmModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="cmTitle"></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body" id="cmBody"></div><div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">取消</button><button class="btn btn-danger" id="cmBtn">确认</button></div></div></div></div>');
            modal = document.getElementById('confirmModal');
        }
        document.getElementById('cmTitle').textContent = title;
        document.getElementById('cmBody').textContent = msg;
        var oldBtn = document.getElementById('cmBtn');
        var newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);
        newBtn.addEventListener('click', async function() {
            bootstrap.Modal.getInstance(modal).hide();
            if (onOk) await onOk();
        });
        new bootstrap.Modal(modal).show();
    }

    function formatDate(ds) {
        if (!ds) return '-';
        var d = new Date(ds), n = new Date();
        var min = Math.floor((n - d) / 60000);
        if (min < 1) return '刚刚';
        if (min < 60) return min + '分钟前';
        if (min < 1440) return Math.floor(min / 60) + '小时前';
        if (min < 10080) return Math.floor(min / 1440) + '天前';
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function statusBadge(s) {
        var m = { published: ['已发布', 'bi-check-circle'], draft: ['草稿', 'bi-pencil'], archived: ['已归档', 'bi-archive'] };
        var v = m[s] || [s, 'bi-question-circle'];
        return '<span class="status-badge status-' + s + '"><i class="bi ' + v[1] + '"></i>' + v[0] + '</span>';
    }

    return {
        init: init,
        login: login,
        logout: logout,
        getUser: function() { return user; },
        showToast: showToast,
        confirm: confirm,
        formatDate: formatDate,
        statusBadge: statusBadge,
        navigate: function(h) { window.location.hash = h; },
        toggleSidebar: function() { var s = document.getElementById('sidebar'); if (s) s.classList.toggle('collapsed'); },
    };
})();

document.addEventListener('DOMContentLoaded', function() { App.init(); });
