/**
 * app.js
 * GitHub REST API からデータを取得し、UIを制御するメインモジュール
 */

// ============================================================
// DOM要素の参照
// ============================================================
const searchForm = document.getElementById('search-form');
const usernameInput = document.getElementById('username-input');
const searchBtn = document.getElementById('search-btn');
const searchSection = document.getElementById('search-section');
const loadingSection = document.getElementById('loading-section');
const errorSection = document.getElementById('error-section');
const errorTitle = document.getElementById('error-title');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const dashboard = document.getElementById('dashboard');
const backBtn = document.getElementById('back-btn');
const quickBtns = document.querySelectorAll('.quick-btn');

// ============================================================
// GitHub API ベースURL
// ============================================================
const GITHUB_API = 'https://api.github.com';

// ============================================================
// ステート管理
// ============================================================
let lastSearchedUsername = '';
let _currentExportData = null; // エクスポート用データキャッシュ

// ============================================================
// テーマ管理
// ============================================================
const THEME_KEY = 'github-stats-theme';

function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    const btn = document.getElementById('btn-theme');
    if (btn) {
        btn.innerHTML = theme === 'dark'
            ? '<i class="fa-solid fa-moon"></i>'
            : '<i class="fa-solid fa-sun"></i>';
    }
    // チャートのborderColorはCSS変数から読み取るため再描画は不要
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ============================================================
// 検索履歴管理
// ============================================================
const HISTORY_KEY = 'github-stats-history';
const MAX_HISTORY = 5;

function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveHistory(username) {
    const history = loadHistory().filter(h => h !== username);
    history.unshift(username);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

function renderHistoryDropdown() {
    const dropdown = document.getElementById('history-dropdown');
    if (!dropdown) return;
    const history = loadHistory();
    if (history.length === 0) {
        dropdown.classList.add('hidden');
        return;
    }
    dropdown.innerHTML = history.map(u => `
        <div class="history-item" data-user="${escapeHtml(u)}">
            <i class="fa-solid fa-clock-rotate-left"></i>
            <span>${escapeHtml(u)}</span>
        </div>
    `).join('');
    dropdown.classList.remove('hidden');

    dropdown.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            const user = item.dataset.user;
            usernameInput.value = user;
            dropdown.classList.add('hidden');
            loadUserStats(user);
        });
    });
}

// ============================================================
// インメモリAPIキャッシュ（セッション中5分TTL）
// ============================================================
const _apiCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(username) {
    const entry = _apiCache.get(username.toLowerCase());
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        _apiCache.delete(username.toLowerCase());
        return null;
    }
    return entry.data;
}

function setCache(username, data) {
    _apiCache.set(username.toLowerCase(), { data, timestamp: Date.now() });
}

// ============================================================
// トースト通知
// ============================================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fa-solid fa-${type === 'success' ? 'check' : type === 'error' ? 'xmark' : 'info'}"></i>
        <span>${escapeHtml(message)}</span>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================
// URL共有
// ============================================================
function updatePageUrl(username) {
    const url = new URL(window.location.href);
    url.searchParams.set('user', username);
    history.replaceState({}, '', url.toString());
}

async function shareProfile() {
    const username = lastSearchedUsername;
    if (!username) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?user=${encodeURIComponent(username)}`;
    if (navigator.share) {
        try {
            await navigator.share({ title: `${username} の GitHub Stats`, url: shareUrl });
        } catch { /* キャンセル時は無視 */ }
    } else {
        try {
            await navigator.clipboard.writeText(shareUrl);
            showToast('URLをクリップボードにコピーしました');
        } catch {
            showToast('コピーに失敗しました', 'error');
        }
    }
}

// ============================================================
// JSONエクスポート
// ============================================================
function exportJSON() {
    if (!_currentExportData) return;
    const payload = {
        exportedAt: new Date().toISOString(),
        user: _currentExportData.user,
        stats: {
            totalStars: calcTotalStars(_currentExportData.repos),
            totalForks: calcTotalForks(_currentExportData.repos),
            publicRepos: _currentExportData.user.public_repos,
            followers: _currentExportData.user.followers,
        },
        topRepositories: _currentExportData.repos
            .sort((a, b) => b.stargazers_count - a.stargazers_count)
            .slice(0, 10)
            .map(r => ({
                name: r.name,
                description: r.description,
                stars: r.stargazers_count,
                forks: r.forks_count,
                language: r.language,
                url: r.html_url,
            })),
        languages: _currentExportData.languages,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `github-stats-${lastSearchedUsername}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('JSONエクスポート完了');
}

// ============================================================
// イベントリスナー登録
// ============================================================
searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    if (username) {
        document.getElementById('history-dropdown')?.classList.add('hidden');
        loadUserStats(username);
    }
});

retryBtn.addEventListener('click', () => {
    if (lastSearchedUsername) loadUserStats(lastSearchedUsername);
});

backBtn.addEventListener('click', () => {
    showSection('search');
    usernameInput.value = '';
    history.replaceState({}, '', window.location.pathname);
    usernameInput.focus();
});

quickBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        const user = btn.dataset.user;
        usernameInput.value = user;
        loadUserStats(user);
    });
});

// 検索入力: フォーカス時に履歴表示
usernameInput.addEventListener('focus', () => {
    renderHistoryDropdown();
});
usernameInput.addEventListener('input', () => {
    if (!usernameInput.value.trim()) {
        renderHistoryDropdown();
    } else {
        document.getElementById('history-dropdown')?.classList.add('hidden');
    }
});
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-input-wrapper') && !e.target.closest('#history-dropdown')) {
        document.getElementById('history-dropdown')?.classList.add('hidden');
    }
});

// テーマボタン
document.getElementById('btn-theme')?.addEventListener('click', toggleTheme);

// シェアボタン
document.getElementById('btn-share')?.addEventListener('click', shareProfile);

// エクスポートボタン
document.getElementById('btn-export')?.addEventListener('click', exportJSON);

// ============================================================
// 表示切替ヘルパー
// ============================================================
function showSection(section) {
    searchSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    errorSection.classList.add('hidden');
    dashboard.classList.add('hidden');

    if (section === 'search') searchSection.classList.remove('hidden');
    if (section === 'loading') loadingSection.classList.remove('hidden');
    if (section === 'error') errorSection.classList.remove('hidden');
    if (section === 'dashboard') dashboard.classList.remove('hidden');
}

function showError(title, message) {
    errorTitle.textContent = title;
    errorMessage.textContent = message;
    showSection('error');
}

// ============================================================
// GitHub API リクエスト
// ============================================================
async function fetchGitHubAPI(endpoint) {
    const res = await fetch(`${GITHUB_API}${endpoint}`, {
        headers: { Accept: 'application/vnd.github+json' },
    });

    if (!res.ok) {
        if (res.status === 404) throw new Error('NOT_FOUND');
        if (res.status === 403) throw new Error('RATE_LIMIT');
        throw new Error(`HTTP_ERROR_${res.status}`);
    }
    return res.json();
}

async function fetchAllRepositories(username) {
    const allRepos = [];
    let page = 1;
    const perPage = 100;

    while (true) {
        const repos = await fetchGitHubAPI(
            `/users/${username}/repos?per_page=${perPage}&page=${page}&sort=updated`
        );
        allRepos.push(...repos);
        if (repos.length < perPage) break;
        page++;
        if (page > 5) break;
    }
    return allRepos;
}

async function fetchAggregatedLanguages(username, repos) {
    const targetRepos = [...repos]
        .sort((a, b) => b.stargazers_count - a.stargazers_count)
        .slice(0, 20);

    const results = await Promise.allSettled(
        targetRepos.map((repo) =>
            fetchGitHubAPI(`/repos/${username}/${repo.name}/languages`)
        )
    );

    const aggregated = {};
    results.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        Object.entries(result.value).forEach(([lang, bytes]) => {
            aggregated[lang] = (aggregated[lang] ?? 0) + bytes;
        });
    });
    return aggregated;
}

// ============================================================
// データ集計ヘルパー
// ============================================================
function calcTotalStars(repos) {
    return repos.reduce((sum, r) => sum + r.stargazers_count, 0);
}

function calcTotalForks(repos) {
    return repos.reduce((sum, r) => sum + r.forks_count, 0);
}

function formatNumber(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}

function formatJoinDate(isoDate) {
    const d = new Date(isoDate);
    return `${d.getFullYear()}年${d.getMonth() + 1}月 参加`;
}

// ============================================================
// UI描画関数
// ============================================================
function renderProfile(user) {
    document.getElementById('avatar').src = user.avatar_url;
    document.getElementById('avatar').alt = `${user.login}のアバター`;
    document.getElementById('profile-name').textContent = user.name ?? user.login;
    document.getElementById('profile-login').textContent = `@${user.login}`;
    document.getElementById('profile-bio').textContent = user.bio ?? '';

    const locationEl = document.getElementById('profile-location');
    if (user.location) {
        locationEl.querySelector('span').textContent = user.location;
        locationEl.classList.remove('hidden');
    } else {
        locationEl.classList.add('hidden');
    }

    const blogEl = document.getElementById('profile-blog');
    if (user.blog) {
        const blogUrl = user.blog.startsWith('http') ? user.blog : `https://${user.blog}`;
        blogEl.href = blogUrl;
        blogEl.querySelector('span').textContent = user.blog.replace(/^https?:\/\//, '');
        blogEl.classList.remove('hidden');
    } else {
        blogEl.classList.add('hidden');
    }

    document.getElementById('profile-joined').querySelector('span').textContent =
        formatJoinDate(user.created_at);

    document.getElementById('github-link').href = user.html_url;
}

function renderStats(user, repos) {
    const totalStars = calcTotalStars(repos);
    const totalForks = calcTotalForks(repos);

    animateCounter('stat-stars', totalStars);
    animateCounter('stat-repos', user.public_repos);
    animateCounter('stat-followers', user.followers);
    animateCounter('stat-forks', totalForks);
}

function animateCounter(elementId, target) {
    const el = document.getElementById(elementId);
    const duration = 600;
    const startTime = performance.now();

    function tick(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * target);
        el.textContent = formatNumber(current);
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function renderTopRepos(repos) {
    const repoGrid = document.getElementById('repo-grid');
    repoGrid.innerHTML = '';

    const topRepos = [...repos]
        .sort((a, b) => b.stargazers_count - a.stargazers_count)
        .slice(0, 6);

    if (topRepos.length === 0) {
        repoGrid.innerHTML = '<p style="color:var(--text-muted)">公開リポジトリがありません</p>';
        return;
    }

    topRepos.forEach((repo) => {
        const card = document.createElement('a');
        card.className = 'repo-card glass-card';
        card.href = repo.html_url;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.setAttribute('aria-label', `${repo.name} リポジトリを開く`);

        const langColor = repo.language ? getLangColor(repo.language) : 'var(--text-muted)';

        card.innerHTML = `
      <div class="repo-name">
        <i class="fa-solid fa-book-open" style="color:var(--accent-blue);font-size:0.8rem;"></i>
        ${escapeHtml(repo.name)}
      </div>
      <p class="repo-desc">${escapeHtml(repo.description ?? 'リポジトリの説明なし')}</p>
      <div class="repo-footer">
        ${repo.language ? `
          <span class="repo-meta">
            <span class="repo-lang-dot" style="background:${langColor}"></span>
            ${escapeHtml(repo.language)}
          </span>
        ` : ''}
        <span class="repo-meta">
          <i class="fa-solid fa-star" style="color:#e3b341;"></i>
          ${formatNumber(repo.stargazers_count)}
        </span>
        <span class="repo-meta">
          <i class="fa-solid fa-code-fork" style="color:#8b949e;"></i>
          ${formatNumber(repo.forks_count)}
        </span>
      </div>
    `;
        repoGrid.appendChild(card);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text)));
    return div.innerHTML;
}

// ============================================================
// メイン処理
// ============================================================
async function loadUserStats(username) {
    lastSearchedUsername = username;
    searchBtn.disabled = true;
    showSection('loading');

    // キャッシュ確認
    const cached = getCached(username);
    if (cached) {
        renderAll(cached.user, cached.repos, cached.languages);
        updatePageUrl(username);
        showSection('dashboard');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        searchBtn.disabled = false;
        return;
    }

    try {
        const [user, repos] = await Promise.all([
            fetchGitHubAPI(`/users/${username}`),
            fetchAllRepositories(username),
        ]);
        const languages = await fetchAggregatedLanguages(username, repos);

        // キャッシュ保存
        setCache(username, { user, repos, languages });

        renderAll(user, repos, languages);
        saveHistory(username);
        updatePageUrl(username);

        showSection('dashboard');
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error('GitHub API エラー:', error);

        if (error.message === 'NOT_FOUND') {
            showError(
                'ユーザーが見つかりません',
                `"${username}" というGitHubユーザーは存在しないか、アクセスできません。`
            );
        } else if (error.message === 'RATE_LIMIT') {
            showError(
                'APIレート制限',
                'GitHub APIのレート制限に達しました。しばらく待ってから再試行してください。'
            );
        } else {
            showError(
                'データ取得に失敗しました',
                `ネットワーク接続を確認して再試行してください。（${error.message}）`
            );
        }
    } finally {
        searchBtn.disabled = false;
    }
}

function renderAll(user, repos, languages) {
    _currentExportData = { user, repos, languages };
    renderProfile(user);
    renderStats(user, repos);
    renderTopRepos(repos);
    renderLanguageChart(languages);
    renderActivityChart(repos);

    // ダッシュボードのユーザー名バッジを更新
    const dashUser = document.getElementById('dashboard-username');
    if (dashUser) dashUser.textContent = user.login;
}

// ============================================================
// URLパラメータからの自動検索
// ============================================================
function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const user = params.get('user');
    if (user && /^[a-zA-Z0-9_-]{1,39}$/.test(user)) {
        usernameInput.value = user;
        loadUserStats(user);
    }
}

// ============================================================
// 初期化
// ============================================================
applyTheme(loadTheme());
checkUrlParams();
usernameInput.focus();
