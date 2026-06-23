/**
 * API client - zero dependencies, pure fetch wrapper.
 */
const API = (() => {
    const BASE_URL = 'http://127.0.0.1:5788';
    let TOKEN = null;

    function setToken(token) {
        TOKEN = token;
        token ? localStorage.setItem('auth_token', token) : localStorage.removeItem('auth_token');
    }

    function getToken() {
        if (!TOKEN) TOKEN = localStorage.getItem('auth_token');
        return TOKEN;
    }

    function getBaseUrl() { return BASE_URL; }

    async function request(method, path, body, isFormData) {
        const headers = {};
        const token = getToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;
        if (!isFormData) headers['Content-Type'] = 'application/json';

        const opts = { method, headers };
        if (body) opts.body = isFormData ? body : JSON.stringify(body);

        let resp;
        try { resp = await fetch(BASE_URL + path, opts); }
        catch (e) { throw { status: 0, message: '无法连接服务器，请确认程序已启动' }; }

        if (resp.status === 401) { setToken(null); window.location.hash = '#/login'; return null; }

        let data;
        try { data = await resp.json(); } catch (e) { throw { status: resp.status, message: '服务器响应异常' }; }

        if (!resp.ok) throw { status: resp.status, message: data.error || '请求失败' };
        return data;
    }

    return {
        get: (p) => request('GET', p),
        post: (p, b) => request('POST', p, b),
        put: (p, b) => request('PUT', p, b),
        delete: (p) => request('DELETE', p),
        upload: (p, fd) => request('POST', p, fd, true),
        uploadPut: (p, fd) => request('PUT', p, fd, true),
        setToken, getToken, getBaseUrl
    };
})();

// Global HTML escape helpers (used by all pages)
function escHtml(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function escAttr(s) { if (!s) return ''; return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
