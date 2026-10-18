const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dashboardPath = path.resolve(__dirname, '..', 'src', 'pages', 'AdminDashboardPage.jsx');
const dashboard = fs.readFileSync(dashboardPath, 'utf8');
const stylesPath = path.resolve(__dirname, '..', 'src', 'styles', 'global.css');
const styles = fs.readFileSync(stylesPath, 'utf8');

test('admin dashboard loads the existing real-data 30-day adherence trend endpoint', () => {
  assert.match(dashboard, /getAdminAdherenceTrend\(auth\.token, 30\)/);
  assert.match(dashboard, /import \{ getAdminAdherenceTrend, getAdminStats \} from '\.\.\/services\/api'/);
  assert.match(dashboard, /await getAdminAdherenceTrend|Promise\.allSettled/);
});

test('adherence trend graph is above KPI cards and visualizes daily data', () => {
  const graphIndex = dashboard.indexOf('className="panel adherence-trend-panel"');
  const kpiIndex = dashboard.indexOf('className="stat-grid dashboard-stat-grid"');

  assert.ok(graphIndex >= 0);
  assert.ok(kpiIndex > graphIndex);
  assert.match(dashboard, /<svg[\s\S]*?className="adherence-trend-chart"/);
  assert.match(dashboard, /Daily medication adherence over the selected period/);
  assert.match(dashboard, /\[0, 25, 50, 75, 100\]/);
  assert.match(dashboard, /adherence: eligible > 0[\s\S]*?: null/);
});

test('no-eligible dates are gaps with explanatory tooltips and the graph is responsive', () => {
  assert.match(dashboard, /No eligible doses/);
  assert.match(dashboard, /Gaps indicate dates with no eligible completed doses/);
  assert.match(dashboard, /point\.adherence === null/);
  assert.match(styles, /\.adherence-trend-chart\s*\{[\s\S]*?width: 100%;[\s\S]*?height: clamp/);
});

test('admin greeting changes by local time and chart height is slightly reduced', () => {
  assert.match(dashboard, /if \(hour < 12\) return 'Good morning'/);
  assert.match(dashboard, /if \(hour < 17\) return 'Good afternoon'/);
  assert.match(dashboard, /return 'Good evening'/);
  assert.match(dashboard, /const height = 320/);
  assert.match(styles, /height: clamp\(250px, 28vw, 320px\)/);
});
