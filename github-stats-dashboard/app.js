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
/** 現在検索中のユーザー名を保持（再試行用） */
let lastSearchedUsername = '';

// ============================================================
// イベントリスナー登録
// ============================================================
searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    if (username) loadUserStats(username);
});

retryBtn.addEventListener('click', () => {
    if (lastSearchedUsername) loadUserStats(lastSearchedUsername);
});

backBtn.addEventListener('click', () => {
    showSection('search');
    usernameInput.value = '';
    usernameInput.focus();
});

quickBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        const user = btn.dataset.user;
        usernameInput.value = user;
        loadUserStats(user);
    });
});

// ============================================================
// 表示切替ヘルパー
// ============================================================
/**
 * 表示するセクションを切り替える
 * @param {'search'|'loading'|'error'|'dashboard'} section
 */
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

/**
 * エラー情報を設定して表示する
 * @param {string} title - エラータイトル
 * @param {string} message - エラーメッセージ
 */
function showError(title, message) {
    errorTitle.textContent = title;
    errorMessage.textContent = message;
    showSection('error');
}

// ============================================================
// GitHub API リクエスト
// ============================================================
/**
 * GitHub APIからJSONデータを取得する
 * @param {string} endpoint - APIエンドポイント（/で始まる）
 * @returns {Promise<Object>} レスポンスJSON
 */
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

/**
 * ユーザーのリポジトリ一覧を全件取得する（ページネーション対応）
 * @param {string} username
 * @returns {Promise<Array>}
 */
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
        // 最大5ページ（500件）まで取得
        if (page > 5) break;
    }
    return allRepos;
}

/**
 * 複数リポジトリの言語情報を並行取得して集計する
 * @param {string} username
 * @param {Array} repos
 * @returns {Promise<Object>} { 言語名: バイト数 }
 */
async function fetchAggregatedLanguages(username, repos) {
    // スター数上位10件のみ言語APIを叩く（レート制限対策）
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
/**
 * リポジトリ配列から総スター数を計算する
 */
function calcTotalStars(repos) {
    return repos.reduce((sum, r) => sum + r.stargazers_count, 0);
}

/**
 * リポジトリ配列から総フォーク数を計算する
 */
function calcTotalForks(repos) {
    return repos.reduce((sum, r) => sum + r.forks_count, 0);
}

/**
 * 数値を読みやすいフォーマットに変換する（例: 1500 → "1.5k"）
 */
function formatNumber(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}

/**
 * ISO 8601 日付文字列を「YYYY年MM月」形式に変換する
 */
function formatJoinDate(isoDate) {
    const d = new Date(isoDate);
    return `${d.getFullYear()}年${d.getMonth() + 1}月 参加`;
}

// ============================================================
// UI描画関数
// ============================================================
/**
 * プロフィールカードを描画する
 */
function renderProfile(user) {
    document.getElementById('avatar').src = user.avatar_url;
    document.getElementById('avatar').alt = `${user.login}のアバター`;
    document.getElementById('profile-name').textContent = user.name ?? user.login;
    document.getElementById('profile-login').textContent = `@${user.login}`;
    document.getElementById('profile-bio').textContent = user.bio ?? '';

    // メタ情報の設定
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

/**
 * 統計カードの数値を更新する
 */
function renderStats(user, repos) {
    const totalStars = calcTotalStars(repos);
    const totalForks = calcTotalForks(repos);

    animateCounter('stat-stars', totalStars);
    animateCounter('stat-repos', user.public_repos);
    animateCounter('stat-followers', user.followers);
    animateCounter('stat-forks', totalForks);
}

/**
 * 数値カウントアップアニメーションを実行する
 * @param {string} elementId - 対象要素ID
 * @param {number} target - 最終値
 */
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

/**
 * トップリポジトリカードを描画する
 */
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

/**
 * XSS対策: HTMLエスケープ
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text)));
    return div.innerHTML;
}

// ============================================================
// メイン処理
// ============================================================
/**
 * GitHubユーザーの統計情報を取得してダッシュボードを表示する
 * @param {string} username - GitHubユーザー名
 */
async function loadUserStats(username) {
    lastSearchedUsername = username;
    searchBtn.disabled = true;
    showSection('loading');

    try {
        // プロフィールとリポジトリを並行取得
        const [user, repos] = await Promise.all([
            fetchGitHubAPI(`/users/${username}`),
            fetchAllRepositories(username),
        ]);

        // 言語情報を取得（時間がかかる可能性があるため後続）
        const languages = await fetchAggregatedLanguages(username, repos);

        // UI描画（各セクションを順番に）
        renderProfile(user);
        renderStats(user, repos);
        renderTopRepos(repos);
        renderLanguageChart(languages);
        renderActivityChart(repos);

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

// ============================================================
// 初期フォーカス
// ============================================================
usernameInput.focus();
