/**
 * Users Page
 */
const UsersPage = {
    async render(container) {
        container.innerHTML = '<div class="spinner-overlay"><div class="spinner-border text-primary"></div></div>';
        try {
            const users = await API.get('/api/admin/users') || [];
            this._table(container, users);
        } catch (e) { container.innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${e.message}</p></div>`; }
    },

    _table(container, users) {
        container.innerHTML = `
        <div class="card border-secondary" style="background:var(--bg-card)">
            <div class="card-header d-flex justify-content-between align-items-center" style="border-bottom:1px solid var(--border-color)"><h6 class="mb-0"><i class="bi bi-people-fill me-2"></i>管理员用户</h6><button class="btn btn-primary btn-sm" onclick="UsersPage._form()"><i class="bi bi-person-plus"></i> 添加用户</button></div>
            <div class="card-body p-0"><div class="table-responsive"><table class="table-dark-custom"><thead><tr><th>用户名</th><th>角色</th><th>状态</th><th>创建时间</th><th style="width:120px">操作</th></tr></thead><tbody>
                ${users.map(u => `<tr>
                    <td><div class="d-flex align-items-center gap-2"><div style="width:32px;height:32px;border-radius:50%;background:${u.role==='superadmin'?'rgba(210,153,29,0.2)':'var(--bg-tertiary)'};display:flex;align-items:center;justify-content:center"><i class="bi bi-person-fill" style="color:${u.role==='superadmin'?'var(--accent-orange)':'var(--text-muted)'}"></i></div><strong>${escHtml(u.username)}</strong></div></td>
                    <td>${u.role==='superadmin'?'<span class="badge bg-warning">超级管理员</span>':'<span class="badge bg-secondary">管理员</span>'}</td>
                    <td>${u.is_active?'<span class="text-success"><i class="bi bi-check-circle"></i> 正常</span>':'<span class="text-danger"><i class="bi bi-x-circle"></i> 禁用</span>'}</td>
                    <td><small style="color:var(--text-muted)">${App.formatDate(u.created_at)}</small></td>
                    <td><button class="btn btn-sm btn-outline-primary" onclick="UsersPage._form(${u.id})"><i class="bi bi-pencil"></i></button>${u.role!=='superadmin'?`<button class="btn btn-sm btn-outline-danger" onclick="UsersPage._del(${u.id},'${escAttr(u.username)}')"><i class="bi bi-trash"></i></button>`:''}</td>
                </tr>`).join('')}
            </tbody></table></div></div>
        </div>`;

        if (!document.getElementById('userModal')) {
            document.body.insertAdjacentHTML('beforeend',
            `<div class="modal fade" id="userModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered"><div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title" id="userModalTitle"></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <form id="userForm" onsubmit="return false">
                        <div class="modal-body">
                            <input type="hidden" id="userId">
                            <div class="mb-3"><label class="form-label">用户名 *</label><input class="form-control" id="userName" required minlength="3"></div>
                            <div class="mb-3"><label class="form-label">密码 <span id="userPwdOpt" class="d-none" style="color:var(--text-muted)">(留空不修改)</span></label><input type="password" class="form-control" id="userPass" minlength="6"></div>
                            <div class="row g-3">
                                <div class="col-md-6"><label class="form-label">角色</label><select class="form-select" id="userRole"><option value="admin">管理员</option><option value="superadmin">超级管理员</option></select></div>
                                <div class="col-md-6"><label class="form-label">状态</label><select class="form-select" id="userActive"><option value="1">启用</option><option value="0">禁用</option></select></div>
                            </div>
                            <div id="userError" class="alert alert-danger d-none mt-3 py-2"></div>
                        </div>
                        <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button><button type="submit" class="btn btn-primary">保存</button></div>
                    </form>
                </div></div>
            </div>`);
            document.getElementById('userForm').addEventListener('submit', () => UsersPage._save());
        }
    },

    _form(id) {
        const isEdit = !!id;
        document.getElementById('userModalTitle').textContent = isEdit?'编辑用户':'添加用户';
        document.getElementById('userId').value = id||'';
        document.getElementById('userName').value = '';
        document.getElementById('userPass').value = '';
        document.getElementById('userRole').value = 'admin';
        document.getElementById('userActive').value = '1';
        document.getElementById('userError').classList.add('d-none');
        document.getElementById('userPwdOpt').classList.toggle('d-none', !isEdit);
        document.getElementById('userPass').required = !isEdit;

        if (isEdit) {
            API.get('/api/admin/users').then(users => {
                const u = (users||[]).find(x => x.id===id);
                if (u) {
                    document.getElementById('userName').value = u.username;
                    document.getElementById('userRole').value = u.role;
                    document.getElementById('userActive').value = u.is_active?'1':'0';
                }
            });
        }
        new bootstrap.Modal(document.getElementById('userModal')).show();
    },

    async _save() {
        const id = document.getElementById('userId').value;
        const name = document.getElementById('userName').value.trim();
        const pass = document.getElementById('userPass').value.trim();
        const role = document.getElementById('userRole').value;
        const active = document.getElementById('userActive').value==='1';
        const err = document.getElementById('userError');

        if (!name||name.length<3) { err.textContent='用户名至少3个字符'; err.classList.remove('d-none'); return; }
        if (!id && (!pass||pass.length<6)) { err.textContent='密码至少6个字符'; err.classList.remove('d-none'); return; }
        if (id && pass && pass.length<6) { err.textContent='密码至少6个字符'; err.classList.remove('d-none'); return; }

        const body = { username:name, role, is_active:active };
        if (pass) body.password = pass;

        try {
            if (id) await API.put(`/api/admin/users/${id}`, body);
            else await API.post('/api/admin/users', body);
            App.showToast(id?'用户已更新':'用户已创建');
            bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
            this.render(document.getElementById('contentArea'));
        } catch (e) { err.textContent=e.message||'保存失败'; err.classList.remove('d-none'); }
    },

    _del(id, name) {
        App.confirm('删除用户', `确定删除用户「${name}」？`, async () => {
            try { await API.delete(`/api/admin/users/${id}`); App.showToast('用户已删除'); this.render(document.getElementById('contentArea')); }
            catch (e) { App.showToast(e.message||'删除失败', 'error'); }
        });
    },
};
