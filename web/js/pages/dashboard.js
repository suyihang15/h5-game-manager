/**
 * Dashboard Page
 */
const DashboardPage = {
    async render(container) {
        container.innerHTML = '<div class="spinner-overlay"><div class="spinner-border text-primary"></div></div>';
        try {
            const s = await API.get('/api/dashboard/stats');
            if (!s) return;
            container.innerHTML = `
            <div class="row g-3 mb-4">
                <div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-icon icon-blue"><i class="bi bi-grid-fill"></i></div><div class="stat-value">${s.total_games}</div><div class="stat-label">游戏总数</div><div class="stat-accent icon-blue" style="background:currentColor"></div></div></div>
                <div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-icon icon-green"><i class="bi bi-check-circle-fill"></i></div><div class="stat-value">${s.published}</div><div class="stat-label">已发布</div><div class="stat-accent icon-green" style="background:currentColor"></div></div></div>
                <div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-icon icon-orange"><i class="bi bi-pencil-fill"></i></div><div class="stat-value">${s.draft}</div><div class="stat-label">草稿</div><div class="stat-accent icon-orange" style="background:currentColor"></div></div></div>
                <div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-icon icon-purple"><i class="bi bi-tags-fill"></i></div><div class="stat-value">${s.total_categories}</div><div class="stat-label">分类数</div><div class="stat-accent icon-purple" style="background:currentColor"></div></div></div>
            </div>
            <div class="row g-3">
                <div class="col-lg-6"><div class="card border-secondary" style="background:var(--bg-card)"><div class="card-header d-flex justify-content-between align-items-center" style="border-bottom:1px solid var(--border-color)"><h6 class="mb-0"><i class="bi bi-clock-history me-2"></i>最近添加</h6><a href="#/games" class="btn btn-sm btn-outline-primary">查看全部</a></div><div class="card-body p-0">
                    ${(s.recent_games||[]).length ? `<div class="list-group list-group-flush">${s.recent_games.map(g => `
                        <div class="list-group-item d-flex align-items-center gap-3" style="background:transparent;border-color:var(--border-color);cursor:pointer" onclick="App.navigate('#/games/${g.slug}/edit')">
                            <div style="width:40px;height:40px;border-radius:8px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">
                                ${g.icon_path?`<img src="${API.getBaseUrl()}/uploads/${g.icon_path}" style="width:100%;height:100%;object-fit:cover">`:'<i class="bi bi-controller" style="color:var(--text-muted)"></i>'}
                            </div>
                            <div class="flex-grow-1 min-w-0"><div style="font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(g.title)}</div><div style="font-size:12px;color:var(--text-secondary)">${g.category_name?`<span class="badge bg-secondary me-1">${escHtml(g.category_name)}</span>`:''}${App.statusBadge(g.status)}</div></div>
                            <small style="color:var(--text-muted)">${App.formatDate(g.created_at)}</small>
                        </div>`).join('')}</div>` : '<div class="text-center py-4" style="color:var(--text-muted)">暂无游戏，<a href="#/games/new">添加第一个</a></div>'}
                </div></div></div>
                <div class="col-lg-6"><div class="card border-secondary" style="background:var(--bg-card)"><div class="card-header" style="border-bottom:1px solid var(--border-color)"><h6 class="mb-0"><i class="bi bi-pie-chart me-2"></i>分类统计</h6></div><div class="card-body p-0">
                    ${(s.category_stats||[]).length ? `<div class="list-group list-group-flush">${s.category_stats.map(c => `
                        <div class="list-group-item d-flex align-items-center gap-3" style="background:transparent;border-color:var(--border-color)"><i class="bi ${c.icon||'bi-folder'}" style="font-size:20px;color:var(--accent)"></i><span class="flex-grow-1">${escHtml(c.name)}</span><span class="badge bg-primary rounded-pill">${c.count} 个游戏</span></div>`).join('')}</div>` : '<div class="text-center py-4" style="color:var(--text-muted)">暂无分类</div>'}
                </div></div></div>
            </div>
            ${(s.top_games||[]).length ? `<div class="card border-secondary mt-3" style="background:var(--bg-card)"><div class="card-header" style="border-bottom:1px solid var(--border-color)"><h6 class="mb-0"><i class="bi bi-trophy me-2"></i>热门游戏</h6></div><div class="card-body p-0"><div class="list-group list-group-flush">${s.top_games.map((g,i) => `<div class="list-group-item d-flex align-items-center gap-3" style="background:transparent;border-color:var(--border-color)"><span style="font-size:18px;font-weight:700;color:var(--text-muted);width:24px;text-align:center">#${i+1}</span><span class="flex-grow-1">${escHtml(g.title)}</span><span class="badge bg-info rounded-pill"><i class="bi bi-play-fill"></i> ${g.play_count}</span></div>`).join('')}</div></div></div>` : ''}`;
        } catch (e) { container.innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${e.message}</p></div>`; }
    }
};
