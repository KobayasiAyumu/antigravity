/**
 * charts.js
 * Chart.js を使ったグラフ描画モジュール
 */

// 言語カラーマップ（GitHubのオフィシャルカラーに準拠）
const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  Ruby: '#701516',
  Go: '#00ADD8',
  Rust: '#dea584',
  PHP: '#4F5D95',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Swift: '#FA7343',
  Kotlin: '#A97BFF',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Dart: '#00B4AB',
  Scala: '#c22d40',
  R: '#198CE7',
  Vue: '#41b883',
  Jupyter: '#DA5B0B',
  default: '#8b949e',
};

/**
 * 言語名からカラーコードを取得する
 * @param {string} lang - 言語名
 * @returns {string} カラーコード
 */
function getLangColor(lang) {
  return LANGUAGE_COLORS[lang] ?? LANGUAGE_COLORS.default;
}

// グラフインスタンスを保持（再描画時に破棄するため）
let languageChartInstance = null;
let activityChartInstance = null;

/**
 * 言語使用率ドーナツチャートを描画する
 * @param {Object} languages - { 言語名: バイト数 } のオブジェクト
 */
function renderLanguageChart(languages) {
  const canvas = document.getElementById('language-chart');
  const legend = document.getElementById('lang-legend');

  // 前回のチャートを破棄
  if (languageChartInstance) {
    languageChartInstance.destroy();
    languageChartInstance = null;
  }
  legend.innerHTML = '';

  // 上位8言語に絞る
  const sorted = Object.entries(languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  if (sorted.length === 0) {
    canvas.parentElement.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px 0;">言語データなし</p>';
    return;
  }

  const total = sorted.reduce((sum, [, v]) => sum + v, 0);
  const labels = sorted.map(([lang]) => lang);
  const data = sorted.map(([, v]) => v);
  const colors = labels.map(getLangColor);

  // ドーナツチャート生成
  languageChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: '#0d1117',
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${pct}%`;
            },
          },
          backgroundColor: '#161b22',
          borderColor: '#30363d',
          borderWidth: 1,
          titleColor: '#e6edf3',
          bodyColor: '#8b949e',
        },
      },
      animation: {
        animateRotate: true,
        duration: 800,
        easing: 'easeOutQuart',
      },
    },
  });

  // カスタム凡例を生成
  sorted.forEach(([lang, bytes]) => {
    const pct = ((bytes / total) * 100).toFixed(1);
    const item = document.createElement('div');
    item.className = 'lang-item';
    item.innerHTML = `
      <span class="lang-dot" style="background:${getLangColor(lang)}"></span>
      <span class="lang-name">${lang}</span>
      <span class="lang-percent">${pct}%</span>
    `;
    legend.appendChild(item);
  });
}

/**
 * 月別リポジトリ更新数の棒グラフを描画する
 * @param {Array} repos - リポジトリ配列（pushed_at プロパティを使用）
 */
function renderActivityChart(repos) {
  const canvas = document.getElementById('activity-chart');

  // 前回のチャートを破棄
  if (activityChartInstance) {
    activityChartInstance.destroy();
    activityChartInstance = null;
  }

  // 過去12ヶ月のラベルと月数を生成
  const now = new Date();
  const months = [];
  const labels = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    labels.push(`${d.getMonth() + 1}月`);
  }

  // 月ごとの更新数を集計
  const counts = {};
  months.forEach((m) => { counts[m] = 0; });

  repos.forEach((repo) => {
    if (!repo.pushed_at) return;
    const pushed = new Date(repo.pushed_at);
    const key = `${pushed.getFullYear()}-${String(pushed.getMonth() + 1).padStart(2, '0')}`;
    if (key in counts) counts[key]++;
  });

  const data = months.map((m) => counts[m]);

  // グラデーション背景を生成
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(57, 211, 83, 0.8)');
  gradient.addColorStop(1, 'rgba(57, 211, 83, 0.15)');

  activityChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '更新されたリポジトリ数',
        data,
        backgroundColor: gradient,
        borderColor: 'rgba(57, 211, 83, 0.9)',
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} リポジトリ更新`,
          },
          backgroundColor: '#161b22',
          borderColor: '#30363d',
          borderWidth: 1,
          titleColor: '#e6edf3',
          bodyColor: '#8b949e',
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(48, 54, 61, 0.5)', drawBorder: false },
          ticks: { color: '#8b949e', font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(48, 54, 61, 0.5)', drawBorder: false },
          ticks: {
            color: '#8b949e',
            font: { size: 11 },
            stepSize: 1,
            precision: 0,
          },
        },
      },
      animation: {
        duration: 800,
        easing: 'easeOutQuart',
      },
    },
  });
}
