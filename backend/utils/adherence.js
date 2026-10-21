const normalizeStatus = (status) => String(status || '').toLowerCase();

const isFutureDose = (scheduledDate, nowDate) => {
  if (!scheduledDate) return false;
  const scheduled = new Date(`${scheduledDate}T00:00:00`);
  if (Number.isNaN(scheduled.getTime())) return false;
  return scheduled > nowDate;
};

const isAfterExpiration = (scheduledDate, expirationDate) => {
  if (!scheduledDate || !expirationDate) return false;
  if (expirationDate === '0000-00-00') return false;
  return scheduledDate > expirationDate;
};

const buildEffectiveMedicationExpirationExpression = (medicationPath = '$medication') => ({
  $let: {
    vars: {
      remainingBatches: {
        $filter: {
          input: { $ifNull: [`${medicationPath}.stockBatches`, []] },
          as: 'batch',
          cond: { $gt: ['$$batch.remainingQuantity', 0] },
        },
      },
    },
    in: {
      $cond: [
        { $eq: [{ $size: '$$remainingBatches' }, 0] },
        `${medicationPath}.expirationDate`,
        {
          $cond: [
            {
              $anyElementTrue: [
                {
                  $map: {
                    input: '$$remainingBatches',
                    as: 'batch',
                    in: {
                      $or: [
                        { $eq: [{ $ifNull: ['$$batch.expirationDate', null] }, null] },
                        { $eq: ['$$batch.expirationDate', ''] },
                      ],
                    },
                  },
                },
              ],
            },
            null,
            {
              $reduce: {
                input: '$$remainingBatches',
                initialValue: null,
                in: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ['$$value', null] },
                        { $gt: ['$$this.expirationDate', '$$value'] },
                      ],
                    },
                    '$$this.expirationDate',
                    '$$value',
                  ],
                },
              },
            },
          ],
        },
      ],
    },
  },
});

const buildEligibleDosePipeline = ({
  medicationCollection,
  userIds,
  startDate,
  endDate,
  today,
}) => [
  {
    $match: {
      ...(userIds ? { userId: { $in: userIds } } : {}),
      scheduledDate: {
        ...(startDate ? { $gte: startDate } : {}),
        ...(endDate ? { $lte: endDate } : {}),
      },
      $expr: {
        $lte: ['$scheduledDate', today],
      },
    },
  },
  {
    $lookup: {
      from: medicationCollection,
      localField: 'medicationId',
      foreignField: '_id',
      as: 'medication',
    },
  },
  {
    $unwind: {
      path: '$medication',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $addFields: {
      effectiveMedicationExpiration: buildEffectiveMedicationExpirationExpression(),
    },
  },
  {
    $match: {
      $or: [
        { effectiveMedicationExpiration: null },
        { effectiveMedicationExpiration: '' },
        {
          $expr: {
            $lte: ['$scheduledDate', '$effectiveMedicationExpiration'],
          },
        },
      ],
    },
  },
  {
    $set: {
      'medication.expirationDate': '$effectiveMedicationExpiration',
    },
  },
];

const calculateCanonicalAdherence = (doses = [], options = {}) => {
  const nowDate = options.now instanceof Date
    ? new Date(options.now.getTime())
    : new Date();

  if (typeof options.now === 'string') {
    const parsed = new Date(`${options.now}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      nowDate.setTime(parsed.getTime());
    }
  }

  const counts = {
    taken: 0,
    skipped: 0,
    missed: 0,
    pending: 0,
  };

  for (const dose of doses) {
    const status = normalizeStatus(dose?.status);
    if (!['taken', 'skipped', 'missed', 'pending'].includes(status)) {
      continue;
    }

    const scheduledDate = dose?.scheduledDate;
    if (isFutureDose(scheduledDate, nowDate)) {
      continue;
    }

    const medicationExpiration = dose?.medicationId?.expirationDate || dose?.medication?.expirationDate;
    if (isAfterExpiration(scheduledDate, medicationExpiration)) {
      continue;
    }

    if (status === 'pending') {
      counts.pending += 1;
      continue;
    }

    counts[status] += 1;
  }

  const eligible = counts.taken + counts.skipped + counts.missed;
  return eligible > 0 ? Math.round((counts.taken / eligible) * 100) : 0;
};

module.exports = {
  buildEligibleDosePipeline,
  buildEffectiveMedicationExpirationExpression,
  calculateCanonicalAdherence,
};
