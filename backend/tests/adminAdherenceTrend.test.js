const test = require('node:test');
const assert = require('node:assert/strict');

const DoseRecord = require('../models/DoseRecord');
const { getAdherenceTrend } = require('../services/adminAnalyticsService');

const formatDate = (date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

test('admin adherence trend returns daily dose outcome counts from dose records', async () => {
  const originalAggregate = DoseRecord.aggregate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = formatDate(yesterday);
  let pipeline;

  DoseRecord.aggregate = async (value) => {
    pipeline = value;
    return [
      { _id: { status: 'taken', scheduledDate: yesterdayDate }, count: 2 },
      { _id: { status: 'skipped', scheduledDate: yesterdayDate }, count: 1 },
    ];
  };

  try {
    const trend = await getAdherenceTrend(7);
    const yesterdayPoint = trend.data.find((item) => item.date === yesterdayDate);
    const emptyPoint = trend.data.find((item) => item.date === formatDate(today));

    assert.equal(trend.days, 7);
    assert.equal(trend.data.length, 7);
    assert.deepEqual(yesterdayPoint, {
      date: yesterdayDate,
      taken: 2,
      skipped: 1,
      missed: 0,
      adherenceRate: 66.67,
    });
    assert.deepEqual(emptyPoint, {
      date: formatDate(today),
      taken: 0,
      skipped: 0,
      missed: 0,
      adherenceRate: 0,
    });
    assert.ok(pipeline.some((stage) => stage.$group?._id?.scheduledDate === '$scheduledDate'));
    assert.ok(pipeline.some((stage) => stage.$group?._id?.status === '$status'));
  } finally {
    DoseRecord.aggregate = originalAggregate;
  }
});
