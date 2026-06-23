/**
 * Games Page - List, Form (with zip import), Play.
 */
const GamesPage = {
    filters: { category: '', status: '', search: '', page: 1, limit: 12 },

    /* ========== List ========== */
    async renderList(container) {
        container.innerHTML = '<div class="spinner-overlay"><div class="spinner-border text-primary"></div></div>';
        let cats = [];
        try { cats = await API.get('/api/categories') || []; } catch (e) {}

        container.innerHTML = `
            <div class="filter-bar">
                <div class="input-group search-input">
                    <span class="input-group-text"><i class="bi bi-search"></i></span>
                    <input class="form-control" id="gameSearch" placeholder="搜索游戏..." value="${escHtml(this.filters.search)}">
                </div>
                <select class="form-select" id="gameCatFilter" style="max-width:180px;">
                    <option value="">全部分类</option>
                    ${cats.map(c => `<option value="${c.slug}" ${this.filters.category===c.slug?'selected':''}>${escHtml(c.name)}</option>`).join('')}
                </select>
                <div class="btn-group" id="statusTabs">
                    ${['', 'published', 'draft', 'archived'].map(v => {
                        const labels = { '': '全部', published: '已发布', draft: '草稿', archived: '已归档' };
                        const icons = { '': 'bi-grid', published: 'bi-check-circle', draft: 'bi-pencil', archived: 'bi-archive' };
                        return `<button class="btn btn-sm ${this.filters.status===v?'btn-primary':'btn-outline-secondary'}" data-s="${v}"><i class="bi ${icons[v]}"></i> ${labels[v]}</button>`;
                    }).join('')}
                </div>
                <button class="btn btn-outline-primary btn-sm" onclick="App.navigate('#/games/new')"><i class="bi bi-plus-lg"></i></button>
            </div>
            <div id="gamesGrid"></div>
            <div id="gamesPagination" class="d-flex justify-content-center mt-4"></div>`;

        document.getElementById('gameSearch').addEventListener('input', e => { this.filters.search=e.target.value; this.filters.page=1; this._load(); });
        document.getElementById('gameCatFilter').addEventListener('change', e => { this.filters.category=e.target.value; this.filters.page=1; this._load(); });
        document.querySelectorAll('#statusTabs button').forEach(b => b.addEventListener('click', () => { this.filters.status=b.dataset.s; this.filters.page=1; this._load(); }));
        this._load();
    },

    async _load() {
        const grid = document.getElementById('gamesGrid'), pg = document.getElementById('gamesPagination');
        if (!grid) return;
        grid.innerHTML = '<div class="spinner-overlay"><div class="spinner-border spinner-border-sm text-primary"></div></div>';

        const p = new URLSearchParams();
        if (this.filters.category) p.set('category', this.filters.category);
        if (this.filters.status) p.set('status', this.filters.status);
        if (this.filters.search) p.set('search', this.filters.search);
        p.set('page', this.filters.page); p.set('limit', this.filters.limit);

        try {
            const d = await API.get(`/api/games?${p}`);
            if (!d) return;
            document.querySelectorAll('#statusTabs button').forEach(b => b.className = `btn btn-sm ${this.filters.status===b.dataset.s?'btn-primary':'btn-outline-secondary'}`);

            if (!d.games.length) {
                grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon"><i class="bi bi-controller"></i></div><h3>暂无游戏</h3><p>${this.filters.search||this.filters.category||this.filters.status?'没有匹配的游戏':'点击下方按钮添加'}</p><button class="btn btn-primary" onclick="App.navigate('#/games/new')"><i class="bi bi-plus-lg"></i> 添加游戏</button></div>`;
                if (pg) pg.innerHTML = '';
                return;
            }
            const base = API.getBaseUrl();

            grid.innerHTML = `<div class="game-card-grid">${d.games.map(g => `
                <div class="game-card">
                    <div class="card-icon" onclick="GamesPage._play('${g.slug}')">
                        ${g.icon_path ? `<img src="${base}/uploads/${g.icon_path}" alt="" loading="lazy">` : '<i class="bi bi-controller"></i>'}
                        ${g.is_featured?'<span style="position:absolute;top:8px;left:8px;font-size:11px" class="badge bg-warning"><i class="bi bi-star-fill"></i></span>':''}
                        ${g.is_local?'<span style="position:absolute;top:8px;right:8px;font-size:10px" class="badge bg-info"><i class="bi bi-box"></i> 本地</span>':''}
                        <div class="play-overlay"><i class="bi bi-play-circle-fill"></i></div>
                    </div>
                    <div class="card-actions" onclick="event.stopPropagation()">
                        <button class="btn btn-sm" style="color:var(--accent-green)" onclick="GamesPage._play('${g.slug}')" title="运行"><i class="bi bi-play-fill"></i></button>
                        <button class="btn btn-sm" style="color:var(--accent)" onclick="App.navigate('#/games/${g.slug}/edit')" title="编辑"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm" style="color:var(--accent-red)" onclick="GamesPage._del('${g.slug}','${escAttr(g.title)}')" title="删除"><i class="bi bi-trash"></i></button>
                    </div>
                    <div class="card-body" onclick="App.navigate('#/games/${g.slug}/edit')">
                        <div class="card-title">${escHtml(g.title)}</div>
                        <div class="card-meta">
                            ${g.category_name?`<span><i class="bi ${g.category_icon||'bi-folder'}"></i> ${escHtml(g.category_name)}</span>`:'<span style="color:var(--text-muted)">未分类</span>'}
                            ${App.statusBadge(g.status)}
                        </div>
                    </div>
                </div>`).join('')}</div>`;

            if (pg && d.total_pages > 1) {
                let h = '';
                for (let i=1; i<=d.total_pages; i++) h += `<li class="page-item ${i===d.page?'active':''}"><button class="page-link" onclick="GamesPage._go(${i})">${i}</button></li>`;
                pg.innerHTML = `<nav><ul class="pagination pagination-sm"><li class="page-item ${d.page<=1?'disabled':''}"><button class="page-link" onclick="GamesPage._go(${d.page-1})">上一页</button></li>${h}<li class="page-item ${d.page>=d.total_pages?'disabled':''}"><button class="page-link" onclick="GamesPage._go(${d.page+1})">下一页</button></li></ul></nav>`;
            } else if (pg) pg.innerHTML = '';
        } catch (e) { grid.innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${e.message}</p></div>`; }
    },

    _go(n) { this.filters.page = n; this._load(); },

    async _play(slug) {
        try {
            const d = await API.get('/api/games/' + slug + '/play');
            if (!d) return;
            let url = d.url;
            if (d.is_local && !url.startsWith('http')) url = API.getBaseUrl() + '/' + url;
            window.open(url, '_blank');
            App.showToast('正在打开: ' + d.title, 'info');
        } catch (e) { App.showToast('获取游戏地址失败', 'error'); }
    },

    _del(slug, title) {
        App.confirm('删除游戏', `确定要删除「${title}」吗？`, async () => {
            try { await API.delete(`/api/games/${slug}`); App.showToast('已删除'); this._load(); }
            catch (e) { App.showToast(e.message||'删除失败', 'error'); }
        });
    },

    /* ========== Form ========== */
    async renderForm(container, editSlug = null) {
        const edit = !!editSlug;
        container.innerHTML = '<div class="spinner-overlay"><div class="spinner-border text-primary"></div></div>';

        let game = null, cats = [];
        try {
            cats = await API.get('/api/categories') || [];
            if (edit) { game = await API.get(`/api/games/${editSlug}`); if (!game) { App.navigate('#/games'); return; } }
        } catch (e) { container.innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${e.message}</p></div>`; return; }

        const g = game || {}, base = API.getBaseUrl();
        container.innerHTML = `
        <div class="row justify-content-center"><div class="col-lg-8">
            <div class="card border-secondary" style="background:var(--bg-card)">
                <div class="card-header d-flex align-items-center gap-2" style="border-bottom:1px solid var(--border-color)">
                    <button class="btn btn-sm btn-outline-secondary" onclick="App.navigate('#/games')"><i class="bi bi-arrow-left"></i></button>
                    <h5 class="mb-0">${edit?'编辑游戏':'添加游戏'}</h5>
                    ${g.is_local?'<span class="badge bg-info ms-auto"><i class="bi bi-box"></i> 本地游戏包</span>':''}
                </div>
                <div class="card-body"><form id="gmForm">
                    <div class="row g-3 mb-3">
                        <div class="col-md-8"><label class="form-label">游戏标题 *</label><input class="form-control" id="gmTitle" value="${escAttr(g.title||'')}" placeholder="输入游戏名称" required></div>
                        <div class="col-md-4"><label class="form-label">标识</label><input class="form-control" id="gmSlug" value="${escAttr(g.slug||'')}" placeholder="自动生成"></div>
                    </div>
                    <div class="mb-3"><label class="form-label">描述</label><textarea class="form-control" id="gmDesc" rows="2">${escAttr(g.description||'')}</textarea></div>

                    <div class="mb-3 p-3 rounded" style="background:var(--bg-primary);border:1px solid var(--border-color)">
                        <label class="form-label mb-2"><i class="bi bi-box-arrow-in-down me-1"></i>游戏来源</label>
                        <div class="form-check form-check-inline mb-3">
                            <input class="form-check-input" type="radio" name="gmSrc" id="gmSrcUrl" value="url" ${!g.is_local?'checked':''}>
                            <label class="form-check-label" for="gmSrcUrl">URL 地址</label>
                        </div>
                        <div class="form-check form-check-inline mb-3">
                            <input class="form-check-input" type="radio" name="gmSrc" id="gmSrcZip" value="zip" ${g.is_local?'checked':''}>
                            <label class="form-check-label" for="gmSrcZip">上传游戏包</label>
                        </div>
                        <div id="gmUrlBox" style="${g.is_local?'display:none':''}">
                            <input class="form-control" id="gmUrl" value="${escAttr(g.url||'')}" placeholder="https://example.com/game/">
                            <small style="color:var(--text-muted)">H5游戏在线地址</small>
                        </div>
                        <div id="gmZipBox" style="${!g.is_local?'display:none':''}">
                            <div class="upload-zone" id="zipZone" style="min-height:120px;cursor:pointer">
                                <div style="padding:24px;text-align:center" id="zipZoneInner">
                                    <i class="bi bi-file-zip" style="font-size:36px;color:var(--text-muted)"></i>
                                    <p style="margin:8px 0 4px;font-size:14px;color:var(--text-secondary)">点击选择 或 拖拽ZIP到此处</p>
                                    <small style="color:var(--text-muted)">支持 .zip .tar.gz .tgz 格式</small>
                                </div>
                            </div>
                            <input type="file" id="gmZipFile" accept=".zip,.tar.gz,.tgz,.gz,.tar" style="display:none">
                            <div id="gmZipInfo" style="display:none;margin-top:8px">
                                <span id="gmZipName" style="font-size:13px;color:var(--accent-green)"></span>
                                <button type="button" class="btn btn-sm btn-outline-secondary ms-2" onclick="document.getElementById('gmZipFile').click()">重新选择</button>
                            </div>
                            ${g.is_local?`<small style="color:var(--text-muted)">当前入口: <code>${escHtml(g.url)}</code></small>`:''}
                        </div>
                    </div>

                    <div class="row g-3 mb-3">
                        <div class="col-md-6"><label class="form-label">分类</label><select class="form-select" id="gmCat"><option value="">无分类</option>${cats.map(c=>`<option value="${c.id}" ${g.category_id===c.id?'selected':''}>${escHtml(c.name)}</option>`).join('')}</select></div>
                        <div class="col-md-3"><label class="form-label">状态</label><select class="form-select" id="gmStatus"><option value="draft" ${g.status==='draft'?'selected':''}>草稿</option><option value="published" ${g.status==='published'?'selected':''}>已发布</option><option value="archived" ${g.status==='archived'?'selected':''}>已归档</option></select></div>
                        <div class="col-md-3"><label class="form-label">排序</label><input type="number" class="form-control" id="gmSort" value="${g.sort_order||0}" min="0"></div>
                    </div>
                    <div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="gmFeat" ${g.is_featured?'checked':''}><label class="form-check-label">精选游戏</label></div>

                    <div class="mb-3"><label class="form-label">游戏图标</label>
                        <div class="upload-zone ${g.icon_path?'has-image':''}" id="iconZone" onclick="document.getElementById('gmIcon').click()">
                            ${g.icon_path?`<img src="${base}/uploads/${g.icon_path}" alt="预览">`:`<div class="py-3"><i class="bi bi-cloud-upload" style="font-size:28px;color:var(--text-muted)"></i><p class="mt-2 mb-0" style="color:var(--text-secondary)">点击上传图标</p><small style="color:var(--text-muted)">建议 256x256 PNG</small></div>`}
                        </div>
                        <input type="file" id="gmIcon" accept="image/*" style="display:none">
                    </div>

                    <div id="gmError" class="alert alert-danger d-none py-2"></div>
                    <div class="d-flex gap-2 justify-content-end">
                        <button type="button" class="btn btn-secondary" onclick="App.navigate('#/games')">取消</button>
                        <button type="submit" class="btn btn-primary" id="gmSave"><span id="gmSaveText">${edit?'保存修改':'添加游戏'}</span><span id="gmSaveSpin" class="spinner-border spinner-border-sm d-none"></span></button>
                    </div>
                </form></div>
            </div>
        </div></div>`;

        // Source toggle
        document.querySelectorAll('input[name="gmSrc"]').forEach(r => r.addEventListener('change', () => {
            document.getElementById('gmUrlBox').style.display = r.value==='url'?'':'none';
            document.getElementById('gmZipBox').style.display = r.value==='zip'?'':'none';
        }));

        // ZIP file - click on zone opens file dialog
        var zipZone = document.getElementById('zipZone');
        var zipFile = document.getElementById('gmZipFile');
        var zipInfo = document.getElementById('gmZipInfo');
        var zipName = document.getElementById('gmZipName');
        var zipInner = document.getElementById('zipZoneInner');

        zipZone.addEventListener('click', function() { zipFile.click(); });

        // Drag and drop
        zipZone.addEventListener('dragover', function(e) { e.preventDefault(); zipZone.style.borderColor = 'var(--accent)'; });
        zipZone.addEventListener('dragleave', function(e) { e.preventDefault(); zipZone.style.borderColor = ''; });
        zipZone.addEventListener('drop', function(e) {
            e.preventDefault();
            zipZone.style.borderColor = '';
            var files = e.dataTransfer.files;
            if (files.length > 0) {
                zipFile.files = files; // Set the file input's files
                showZipFile(files[0]);
            }
        });

        zipFile.addEventListener('change', function() {
            var f = zipFile.files[0];
            if (f) showZipFile(f);
        });

        function showZipFile(f) {
            var sizeKB = (f.size / 1024).toFixed(1);
            zipName.textContent = '已选择: ' + f.name + ' (' + sizeKB + ' KB)';
            zipInfo.style.display = '';
            zipInner.innerHTML = '<i class="bi bi-file-earmark-zip" style="font-size:36px;color:var(--accent-green)"></i><p style="margin:8px 0 4px;font-size:14px;color:var(--accent-green)">' + f.name + '</p><small style="color:var(--text-muted)">' + sizeKB + ' KB</small>';
        }

        // Icon preview
        document.getElementById('gmIcon').addEventListener('change', e => {
            const f = e.target.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = ev => { document.getElementById('iconZone').classList.add('has-image'); document.getElementById('iconZone').innerHTML = `<img src="${ev.target.result}" alt="预览">`; };
            r.readAsDataURL(f);
        });

        // Slug auto
        document.getElementById('gmTitle').addEventListener('input', function() {
            const s = document.getElementById('gmSlug');
            if (!edit || !s.value) s.placeholder = this.value.toLowerCase().replace(/[^\w\s-]/g,'').replace(/[\s_]+/g,'-').replace(/-+/g,'-').trim('-')||'';
        });

        // Submit
        document.getElementById('gmForm').addEventListener('submit', async e => { e.preventDefault(); await this._save(edit, editSlug); });
    },

    async _save(edit, slug) {
        const err = document.getElementById('gmError'), bt = document.getElementById('gmSaveText'), sp = document.getElementById('gmSaveSpin');
        err.classList.add('d-none'); bt.classList.add('d-none'); sp.classList.remove('d-none');

        const useZip = document.getElementById('gmSrcZip').checked;
        const title = document.getElementById('gmTitle').value.trim();
        const gslug = document.getElementById('gmSlug').value.trim();
        const desc = document.getElementById('gmDesc').value.trim();
        const url = useZip ? '' : document.getElementById('gmUrl').value.trim();
        const cid = document.getElementById('gmCat').value;
        const status = document.getElementById('gmStatus').value;
        const sort = document.getElementById('gmSort').value;
        const feat = document.getElementById('gmFeat').checked;
        const icon = document.getElementById('gmIcon').files[0];
        const zip = useZip ? document.getElementById('gmZipFile').files[0] : null;

        if (!title) { this._err(err,bt,sp,'请输入游戏标题'); return; }
        if (!useZip && !url) { this._err(err,bt,sp,'请输入游戏URL'); return; }
        if (useZip && !zip && !edit) { this._err(err,bt,sp,'请上传游戏压缩包'); return; }

        try {
            if (icon || zip) {
                const fd = new FormData();
                fd.append('title', title);
                if (gslug) fd.append('slug', gslug);
                fd.append('description', desc);
                if (!useZip) fd.append('url', url);
                fd.append('category_id', cid);
                fd.append('status', status);
                fd.append('sort_order', sort);
                fd.append('is_featured', feat?'1':'0');
                if (icon) fd.append('icon', icon);
                if (zip) fd.append('package', zip);

                const path = edit ? `/api/games/${slug}` : '/api/games';
                if (edit) await API.uploadPut(path, fd);
                else await API.upload(path, fd);
            } else {
                const body = { title, slug:gslug||undefined, description:desc, url, category_id:cid||null, status, sort_order:parseInt(sort)||0, is_featured:feat };
                if (edit) await API.put(`/api/games/${slug}`, body);
                else await API.post('/api/games', body);
            }
            App.showToast(edit?'游戏已更新':'游戏已创建');
            App.navigate('#/games');
        } catch (e) { this._err(err,bt,sp,e.message||'保存失败'); }
    },

    _err(err, bt, sp, msg) { err.textContent=msg; err.classList.remove('d-none'); bt.classList.remove('d-none'); sp.classList.add('d-none'); },
};
