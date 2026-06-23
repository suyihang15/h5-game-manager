/**
 * Settings Page
 */
const SettingsPage = {
    async render(container) {
        container.innerHTML = '<div class="spinner-overlay"><div class="spinner-border text-primary"></div></div>';
        let s = {};
        try { s = await API.get('/api/public/settings') || {}; }
        catch (e) { container.innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${e.message}</p></div>`; return; }

        container.innerHTML = `
        <div class="row justify-content-center"><div class="col-lg-8">
            <div class="card border-secondary" style="background:var(--bg-card)"><div class="card-header" style="border-bottom:1px solid var(--border-color)"><h6 class="mb-0"><i class="bi bi-gear-fill me-2"></i>系统设置</h6></div>
                <div class="card-body"><form id="settingsForm">
                    <div class="mb-3"><label class="form-label">应用名称</label><input class="form-control" id="setName" value="${escAttr(s.app_name||'H5游戏管理器')}"></div>
                    <div class="mb-3"><label class="form-label">应用描述</label><textarea class="form-control" id="setDesc" rows="2">${escAttr(s.app_description||'')}</textarea></div>
                    <div class="row g-3 mb-3">
                        <div class="col-md-6"><label class="form-label">每页游戏数</label><select class="form-select" id="setPerPage"><option value="8" ${s.games_per_page==='8'?'selected':''}>8</option><option value="12" ${s.games_per_page==='12'?'selected':''}>12</option><option value="24" ${s.games_per_page==='24'?'selected':''}>24</option><option value="48" ${s.games_per_page==='48'?'selected':''}>48</option></select></div>
                        <div class="col-md-6"><label class="form-label">默认游戏状态</label><select class="form-select" id="setDefStatus"><option value="draft" ${s.default_status==='draft'?'selected':''}>草稿</option><option value="published" ${s.default_status==='published'?'selected':''}>已发布</option></select></div>
                    </div>
                    <div class="mb-3"><label class="form-label">主题</label><select class="form-select" id="setTheme" style="max-width:200px"><option value="dark" ${s.theme==='dark'?'selected':''}>深色模式</option><option value="light" ${s.theme==='light'?'selected':''}>浅色模式</option></select></div>
                    <div id="settingsErr" class="alert alert-danger d-none py-2"></div>
                    <div class="d-flex justify-content-end"><button type="submit" class="btn btn-primary" id="setSave"><span id="setSaveText">保存设置</span><span id="setSaveSpin" class="spinner-border spinner-border-sm d-none"></span></button></div>
                </form></div>
            </div>
            <div class="card border-secondary mt-4" style="background:var(--bg-card)"><div class="card-header" style="border-bottom:1px solid var(--border-color)"><h6 class="mb-0"><i class="bi bi-database me-2"></i>数据管理</h6></div>
                <div class="card-body"><div class="row g-3">
                    <div class="col-md-6"><h6>导出游戏</h6><p class="text-muted" style="font-size:13px">将所有游戏导出为JSON文件</p><button class="btn btn-outline-primary" onclick="SettingsPage._export()"><i class="bi bi-download"></i> 导出JSON</button></div>
                    <div class="col-md-6"><h6>导入游戏</h6><p class="text-muted" style="font-size:13px">从JSON批量导入</p><div class="input-group"><input type="file" class="form-control" id="importFile" accept=".json"><button class="btn btn-outline-warning" onclick="SettingsPage._import()"><i class="bi bi-upload"></i> 导入</button></div><div id="importResult" class="mt-2" style="font-size:13px"></div></div>
                </div></div>
            </div>
        </div></div>`;

        document.getElementById('settingsForm').addEventListener('submit', async e => {
            e.preventDefault();
            const err = document.getElementById('settingsErr'), bt = document.getElementById('setSaveText'), sp = document.getElementById('setSaveSpin');
            err.classList.add('d-none'); bt.classList.add('d-none'); sp.classList.remove('d-none');
            const body = { app_name:document.getElementById('setName').value.trim(), app_description:document.getElementById('setDesc').value.trim(), games_per_page:document.getElementById('setPerPage').value, default_status:document.getElementById('setDefStatus').value, theme:document.getElementById('setTheme').value };
            try {
                await API.put('/api/admin/settings', body);
                App.showToast('设置已保存');
                document.documentElement.setAttribute('data-bs-theme', body.theme);
                document.querySelector('.app-title').textContent = body.app_name;
            } catch (e) { err.textContent=e.message||'保存失败'; err.classList.remove('d-none'); }
            bt.classList.remove('d-none'); sp.classList.add('d-none');
        });
    },

    async _export() {
        try {
            const d = await API.get('/api/games/export');
            if (d) {
                const blob = new Blob([JSON.stringify(d,null,2)], {type:'application/json'});
                const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`games-${new Date().toISOString().slice(0,10)}.json`; a.click();
                App.showToast('已导出');
            }
        } catch (e) { App.showToast(e.message||'导出失败', 'error'); }
    },

    async _import() {
        const f = document.getElementById('importFile').files[0];
        const r = document.getElementById('importResult');
        if (!f) { r.innerHTML='<span class="text-warning">请选择JSON文件</span>'; return; }
        try {
            const text = await f.text();
            const d = JSON.parse(text);
            if (!d.games||!Array.isArray(d.games)) { r.innerHTML='<span class="text-danger">无效的数据格式</span>'; return; }
            const result = await API.post('/api/games/import', {games:d.games});
            r.innerHTML = `<span class="text-success"><i class="bi bi-check-circle"></i> ${result.message}</span>`;
            App.showToast(result.message);
        } catch (e) { r.innerHTML=`<span class="text-danger">导入失败: ${e.message}</span>`; App.showToast('导入失败', 'error'); }
    },
};
