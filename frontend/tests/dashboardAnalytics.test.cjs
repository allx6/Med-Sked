const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('patient dashboard displays the analytics API time-of-day chart inline', () => {
  const dashboard = read('screens/DashboardScreen.js');
  const analytics = read('screens/AnalyticsScreen.js');
  const chart = read('components/TimeOfDayPieChart.js');

  assert.match(dashboard, /getAdherenceAnalytics\(token, getDashboardAnalyticsRange\(\)\)/);
  assert.match(dashboard, /<TimeOfDayPieChart timeOfDay=\{analytics\?\.timeOfDay\}/);
  assert.doesNotMatch(dashboard, /onOpenAnalytics/);
  assert.match(analytics, /getAdherenceAnalytics\(token, \{/);
  assert.match(chart, /Svg width=\{size\} height=\{size\}/);
});

test('shared patient pie visualization updates from real time-of-day values and handles empty buckets', () => {
  const chart = read('components/TimeOfDayPieChart.js');

  assert.match(chart, /timeOfDay\[bucket\] \|\| emptyBucket\(\)/);
  assert.match(chart, /No dose data for this period/);
  assert.match(chart, /bucketOrder = \['morning', 'afternoon', 'evening', 'night'\]/);
});

test('caregiver dashboard displays one-patient or authorized multi-patient analytics inline', () => {
  const dashboard = read('screens/CaregiverDashboardScreen.js');
  const api = read('services/api.js');

  assert.match(dashboard, /getAdherenceAnalytics\(token, \{/);
  assert.match(dashboard, /patientId: patient\._id/);
  assert.match(dashboard, /getCaregiverOverviewAnalytics\(token, range\)/);
  assert.match(dashboard, /<TimeOfDayPieChart timeOfDay=\{analytics\?\.timeOfDay\}/);
  assert.doesNotMatch(dashboard, /onOpenAnalytics/);
  assert.match(api, /\/api\/analytics\/adherence\/caregiver-overview/);
});
