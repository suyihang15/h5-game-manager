/**
 * Categories Page
 */
const CategoriesPage = {
    async render(container) {
        container.innerHTML = '<div class="spinner-overlay"><div class="spinner-border text-primary"></div></div>';
        try {
            const cats = await API.get('/api/categories') || [];
            this._table(container, cats);
        } catch (e) { container.innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${e.message}</p></div>`; }
    },

    _table(container, cats) {
        container.innerHTML = `
        <div class="card border-secondary" style="background:var(--bg-card)">
            <div class="card-header d-flex justify-content-between align-items-center" style="border-bottom:1px solid var(--border-color)"><h6 class="mb-0"><i class="bi bi-tags-fill me-2"></i>游戏分类</h6><button class="btn btn-primary btn-sm" onclick="CategoriesPage._form()"><i class="bi bi-plus-lg"></i> 添加分类</button></div>
            <div class="card-body p-0">
                ${cats.length===0 ? `<div class="empty-state"><div class="empty-icon"><i class="bi bi-tags"></i></div><h3>暂无分类</h3><p>创建分类来组织游戏</p><button class="btn btn-primary" onclick="CategoriesPage._form()"><i class="bi bi-plus-lg"></i> 添加分类</button></div>`
                : `<div class="table-responsive"><table class="table-dark-custom"><thead><tr><th style="width:40px"></th><th>名称</th><th>标识</th><th>描述</th><th>游戏数</th><th>排序</th><th>状态</th><th style="width:100px">操作</th></tr></thead><tbody>
                ${cats.map(c => `<tr>
                    <td><i class="bi ${c.icon||'bi-folder'}" style="font-size:18px;color:var(--accent)"></i></td>
                    <td><strong>${escHtml(c.name)}</strong></td>
                    <td><code style="font-size:12px">${escHtml(c.slug)}</code></td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(c.description||'-')}</td>
                    <td><span class="badge bg-primary rounded-pill">${c.game_count||0}</span></td>
                    <td>${c.sort_order}</td>
                    <td>${c.is_active?'<span class="text-success"><i class="bi bi-check-circle"></i> 启用</span>':'<span class="text-muted"><i class="bi bi-x-circle"></i> 禁用</span>'}</td>
                    <td><button class="btn btn-sm btn-outline-primary" onclick="CategoriesPage._form(${c.id})" title="编辑"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="CategoriesPage._del(${c.id},'${escAttr(c.name)}')" title="删除"><i class="bi bi-trash"></i></button></td>
                </tr>`).join('')}
                </tbody></table></div>`}
            </div>
        </div>`;

        // Ensure modal exists
        if (!document.getElementById('catModal')) {
            document.body.insertAdjacentHTML('beforeend',
            `<div class="modal fade" id="catModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered"><div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title" id="catModalTitle"></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <form id="catForm" onsubmit="return false">
                        <div class="modal-body">
                            <input type="hidden" id="catId">
                            <div class="mb-3"><label class="form-label">名称 *</label><input class="form-control" id="catName" required></div>
                            <div class="mb-3"><label class="form-label">标识</label><input class="form-control" id="catSlug" placeholder="自动生成"></div>
                            <div class="mb-3"><label class="form-label">描述</label><textarea class="form-control" id="catDesc" rows="2"></textarea></div>
                            <div class="row g-3">
                                <div class="col-md-4"><label class="form-label">图标</label><select class="form-select" id="catIcon">${['bi-folder','bi-joystick','bi-puzzle','bi-cup-hot','bi-compass','bi-crosshair','bi-car-front','bi-music-note','bi-dice-6','bi-heart','bi-bullseye','bi-stars'].map(i=>`<option value="${i}">${i.replace('bi-','')}</option>`).join('')}</select></div>
                                <div class="col-md-4"><label class="form-label">排序</label><input type="number" class="form-control" id="catSort" value="0" min="0"></div>
                                <div class="col-md-4"><label class="form-label">状态</label><select class="form-select" id="catActive"><option value="1">启用</option><option value="0">禁用</option></select></div>
                            </div>
                            <div id="catError" class="alert alert-danger d-none mt-3 py-2"></div>
                        </div>
                        <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button><button type="submit" class="btn btn-primary">保存</button></div>
                    </form>
                </div></div>
            </div>`);
            document.getElementById('catForm').addEventListener('submit', () => CategoriesPage._save());
        }
    },

    _form(id) {
        const isEdit = !!id;
        document.getElementById('catModalTitle').textContent = isEdit?'编辑分类':'添加分类';
        document.getElementById('catId').value = id||'';
        document.getElementById('catName').value = '';
        document.getElementById('catSlug').value = '';
        document.getElementById('catDesc').value = '';
        document.getElementById('catSort').value = '0';
        document.getElementById('catActive').value = '1';
        document.getElementById('catIcon').value = 'bi-folder';
        document.getElementById('catError').classList.add('d-none');

        if (isEdit) {
            API.get('/api/categories').then(cats => {
                const c = (cats||[]).find(x => x.id===id);
                if (c) {
                    document.getElementById('catName').value = c.name;
                    document.getElementById('catSlug').value = c.slug;
                    document.getElementById('catDesc').value = c.description||'';
                    document.getElementById('catSort').value = c.sort_order;
                    document.getElementById('catActive').value = c.is_active?'1':'0';
                    document.getElementById('catIcon').value = c.icon||'bi-folder';
                }
            });
        }
        new bootstrap.Modal(document.getElementById('catModal')).show();
    },

    async _save() {
        const id = document.getElementById('catId').value;
        const name = document.getElementById('catName').value.trim();
        const slug = document.getElementById('catSlug').value.trim();
        const desc = document.getElementById('catDesc').value.trim();
        const icon = document.getElementById('catIcon').value;
        const sort = parseInt(document.getElementById('catSort').value)||0;
        const active = document.getElementById('catActive').value==='1';
        const err = document.getElementById('catError');

        if (!name) { err.textContent='请输入分类名称'; err.classList.remove('d-none'); return; }
        const body = { name, slug:slug||undefined, description:desc, icon, sort_order:sort, is_active:active };

        try {
            if (id) await API.put(`/api/categories/${slug}`, body);
            else await API.post('/api/categories', body);
            App.showToast(id?'分类已更新':'分类已创建');
            bootstrap.Modal.getInstance(document.getElementById('catModal')).hide();
            this.render(document.getElementById('contentArea'));
        } catch (e) { err.textContent=e.message||'保存失败'; err.classList.remove('d-none'); }
    },

    async _del(id, name) {
        App.confirm('删除分类', `确定删除「${name}」？分类下游戏将变为"未分类"。`, async () => {
            const cats = await API.get('/api/categories');
            const c = (cats||[]).find(x => x.id===id);
            if (c) {
                await API.delete(`/api/categories/${c.slug}`);
                App.showToast('分类已删除');
                this.render(document.getElementById('contentArea'));
            }
        });
    },
};
