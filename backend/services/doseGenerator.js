const DoseRecord = require('../models/DoseRecord');
const MedicationSchedule = require('../models/MedicationSchedule');
const Medication = require('../models/Medication');

const logDoseTiming = (label, startTime) => {
  const elapsed = performance.now() - startTime;
  console.log(`[Backend][Dose] ${label}: ${elapsed.toFixed(0)} ms`);
};


// =====================================================
// DAY NAMES
// =====================================================

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];


// =====================================================
// FORMAT DATE
// YYYY-MM-DD
// =====================================================

const formatDate = (date) => {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};


// =====================================================
// PARSE LOCAL DATE STRING
//
// IMPORTANT:
// new Date('2026-09-08') is treated as UTC in JavaScript,
// which can shift the calendar day depending on timezone.
// Use a local date constructor to avoid off-by-one day
// issues when evaluating schedule days and generating doses.
// =====================================================

const parseLocalDateString = (dateString) => {
  if (!dateString) {
    return new Date(NaN);
  }

  const parts = String(dateString).split('-');

  if (parts.length !== 3) {
    return new Date(dateString);
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    return new Date(NaN);
  }

  return new Date(year, month, day);
};


// =====================================================
// FORMAT TIME
// h:mm AM/PM
// =====================================================

const formatTime = (hours, minutes) => {
  const period =
    hours >= 12
      ? 'PM'
      : 'AM';

  let displayHour =
    hours % 12;

  if (displayHour === 0) {
    displayHour = 12;
  }

  return (
    `${displayHour}:` +
    `${String(minutes).padStart(2, '0')} ` +
    `${period}`
  );
};


// =====================================================
// PARSE SCHEDULE TIME
//
// Examples:
// 8:00 AM
// 10:30 PM
// =====================================================

const parseTime = (timeString) => {
  if (!timeString) {
    return null;
  }

  const normalizedTime = timeString.trim();
  const twelveHourMatch = normalizedTime.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  );
  const twentyFourHourMatch = normalizedTime.match(
    /^(\d{2}):(\d{2})$/
  );

  if (!twelveHourMatch && !twentyFourHourMatch) {
    return null;
  }

  if (twentyFourHourMatch) {
    const hours = Number(twentyFourHourMatch[1]);
    const minutes = Number(twentyFourHourMatch[2]);

    if (hours > 23 || minutes > 59) {
      return null;
    }

    return {
      hours,
      minutes,
    };
  }

  let hours =
    parseInt(
      twelveHourMatch[1],
      10
    );

  const minutes =
    parseInt(
      twelveHourMatch[2],
      10
    );

  const period =
    twelveHourMatch[3].toUpperCase();

  if (
    hours < 1 ||
    hours > 12 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  if (period === 'AM') {
    if (hours === 12) {
      hours = 0;
    }
  } else {
    if (hours !== 12) {
      hours += 12;
    }
  }

  return {
    hours,
    minutes,
  };
};


// =====================================================
// GET FREQUENCY INTERVAL
//
// Examples:
//
// Every 30 minutes -> 30
// Every 8 hours -> 480
// Every 2 days -> 2880
//
// Returns the interval in minutes, or null for normal frequencies.
// =====================================================

const getFrequencyInterval = (
  frequency
) => {
  if (!frequency) {
    return null;
  }

  const text =
    frequency
      .toLowerCase()
      .trim();

  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(minutes?|hours?|days?)/
  );

  if (!match) {
    return null;
  }

  const amount =
    Number(match[1]);

  if (!(amount > 0)) {
    return null;
  }

  const unit = match[2].toLowerCase();

  if (unit.startsWith('minute')) {
    return amount;
  }

  if (unit.startsWith('hour')) {
    return amount * 60;
  }

  if (unit.startsWith('day')) {
    return amount * 24 * 60;
  }

  return null;
};


// =====================================================
// GET DAILY DOSE COUNT
//
// Examples:
//
// Every 30 minutes -> 48
// Every 8 hours -> 3
// Every 2 days -> 1
// Daily -> 1
// Twice daily -> 2
// Three times daily -> 3
// Four times daily -> 4
// =====================================================

const getDailyDoseCount = (
  frequency
) => {
  if (!frequency) {
    return 1;
  }

  const text =
    frequency
      .toLowerCase()
      .trim();

  const interval =
    getFrequencyInterval(
      text
    );

  if (interval) {
    return Math.ceil((24 * 60) / interval);
  }

  if (
    text.includes('twice') ||
    text.includes('2 times')
  ) {
    return 2;
  }

  if (
    text.includes('three times') ||
    text.includes('3 times')
  ) {
    return 3;
  }

  if (
    text.includes('four times') ||
    text.includes('4 times')
  ) {
    return 4;
  }

  return 1;
};


// =====================================================
// CHECK WHETHER SCHEDULE APPLIES TO DATE
// =====================================================

const scheduleAppliesToDate = (
  schedule,
  date
) => {
  const dateString =
    formatDate(date);


  // ---------------------------------------------------
  // START DATE
  // ---------------------------------------------------

  if (
    schedule.startDate &&
    dateString < schedule.startDate
  ) {
    return false;
  }


  // ---------------------------------------------------
  // END DATE
  // ---------------------------------------------------

  if (
    schedule.endDate &&
    dateString > schedule.endDate
  ) {
    return false;
  }


  // ---------------------------------------------------
  // ENABLED
  // ---------------------------------------------------

  if (!schedule.enabled) {
    return false;
  }


  // ---------------------------------------------------
  // DAY OF WEEK
  // ---------------------------------------------------

  const dayName =
    DAYS_OF_WEEK[
      date.getDay()
    ];

  if (
    !Array.isArray(
      schedule.days
    ) ||
    !schedule.days.includes(
      dayName
    )
  ) {
    return false;
  }

  return true;
};


// =====================================================
// CREATE SINGLE DOSE
// =====================================================

const createDoseIfNotExists = async ({
  userId,
  medicationId,
  scheduleId,
  scheduledDate,
  scheduledTime,
}) => {

  try {

    const dose =
      await DoseRecord.create({
        userId,

        medicationId,

        scheduleId,

        scheduledDate,

        scheduledTime,

        status: 'pending',

        takenAt: null,
      });

    return {
      created: true,
      dose,
    };

  } catch (error) {

    // Duplicate dose.
    // This is expected when the dashboard
    // generates today's doses more than once.

    if (error.code === 11000) {
      return {
        created: false,
        dose: null,
      };
    }

    throw error;
  }
};

const reconcilePendingDosesForSchedule = async ({
  userId,
  scheduleId,
  fromDate = new Date(),
}) => {
  const fromDateString = formatDate(fromDate);

  const result = await DoseRecord.deleteMany({
    userId,
    scheduleId,
    status: 'pending',
    scheduledDate: {
      $gte: fromDateString,
    },
  });

  return result.deletedCount || 0;
};


// =====================================================
// GENERATE DOSES FOR ONE DATE
// =====================================================

const generateDosesForDate = async (
  userId,
  targetDate
) => {

  const scheduleQueryStart = performance.now();
  const schedules =
    await MedicationSchedule.find({
      userId,
      enabled: true,
    }).lean();
  logDoseTiming('Schedule query', scheduleQueryStart);

  const medicationIds = [
    ...new Set(
      schedules
        .map((schedule) => schedule.medicationId)
        .filter(Boolean)
        .map((id) => id.toString())
    )
  ];

  const medicationQueryStart = performance.now();
  const medicationRecords = medicationIds.length > 0
    ? await Medication.find({
        _id: { $in: medicationIds },
        userId,
      }).lean()
    : [];
  const medicationsById = new Map(
    medicationRecords.map((medication) => [String(medication._id), medication])
  );
  logDoseTiming('Medication query', medicationQueryStart);

  let createdCount = 0;
  const processingStart = performance.now();

  for (
    const schedule of schedules
  ) {

    // -------------------------------------------------
    // CHECK WHETHER SCHEDULE APPLIES
    // -------------------------------------------------

    if (
      !scheduleAppliesToDate(
        schedule,
        targetDate
      )
    ) {
      continue;
    }


    // -------------------------------------------------
    // GET MEDICATION
    // -------------------------------------------------

    const medication = medicationsById.get(String(schedule.medicationId));

    if (!medication) {
      continue;
    }


    // -------------------------------------------------
    // PARSE SCHEDULE TIME
    // -------------------------------------------------

    const parsedTime =
      parseTime(
        schedule.time
      );


    if (!parsedTime) {

      console.warn(
        `Invalid schedule time: ${schedule.time}`
      );

      continue;
    }


    // -------------------------------------------------
    // GET FREQUENCY
    // -------------------------------------------------

    const interval =
      getFrequencyInterval(
        medication.frequency
      );


    // -------------------------------------------------
    // DOSES TO CREATE
    // -------------------------------------------------

    const dosesToCreate = [];


    // -------------------------------------------------
    // INTERVAL-BASED MEDICATION
    // -------------------------------------------------

    if (interval) {

      const count =
        getDailyDoseCount(
          medication.frequency
        );


      for (
        let i = 0;
        i < count;
        i++
      ) {

        const totalMinutes =
          (
            parsedTime.hours * 60
          ) +
          parsedTime.minutes +
          (
            i * interval
          );


        const minutesInDay =
          24 * 60;


        const normalizedMinutes =
          totalMinutes %
          minutesInDay;


        const hours =
          Math.floor(
            normalizedMinutes / 60
          );


        const minutes =
          normalizedMinutes % 60;


        const dayOffset =
          Math.floor(
            totalMinutes /
            minutesInDay
          );


        const doseDate =
          parseLocalDateString(
            formatDate(
              targetDate
            )
          );


        doseDate.setDate(
          doseDate.getDate() +
          dayOffset
        );


        const scheduledDate =
          formatDate(
            doseDate
          );


        const scheduledTime =
          formatTime(
            hours,
            minutes
          );


        // ------------------------------------------------
        // IMPORTANT
        //
        // Only create a dose if the calculated date
        // is still within the schedule's date range.
        // ------------------------------------------------

        if (
          schedule.startDate &&
          scheduledDate <
            schedule.startDate
        ) {
          continue;
        }


        if (
          schedule.endDate &&
          scheduledDate >
            schedule.endDate
        ) {
          continue;
        }


        dosesToCreate.push({
          scheduledDate,
          scheduledTime,
        });
      }

    } else {

      // -------------------------------------------------
      // NORMAL DAILY / MULTIPLE DAILY SCHEDULE
      //
      // The existing schedule represents the selected
      // time. We preserve that behavior.
      // -------------------------------------------------

      dosesToCreate.push({
        scheduledDate:
          formatDate(
            targetDate
          ),

        scheduledTime:
          formatTime(
            parsedTime.hours,
            parsedTime.minutes
          ),
      });
    }


    // -------------------------------------------------
    // CREATE DOSES
    // -------------------------------------------------

    for (
      const doseData of dosesToCreate
    ) {

      const result =
        await createDoseIfNotExists({
          userId,

          medicationId:
            medication._id,

          scheduleId:
            schedule._id,

          scheduledDate:
            doseData.scheduledDate,

          scheduledTime:
            doseData.scheduledTime,
        });


      if (result.created) {
        createdCount++;
      }
    }
  }

  logDoseTiming('Processing schedules', processingStart);

  return createdCount;
};


// =====================================================
// GENERATE TODAY'S DOSES
//
// We check yesterday as well because an interval can
// cross midnight.
//
// Example:
//
// Monday 8:00 AM
// + 8 hours = Monday 4:00 PM
// + 8 hours = Tuesday 12:00 AM
// =====================================================

const generateTodayDoses = async (
  userId
) => {

  console.log('[Backend][Dose] Generation started');
  const totalStart = performance.now();

  const today =
    new Date();


  today.setHours(
    0,
    0,
    0,
    0
  );


  const yesterday =
    new Date(
      today
    );


  yesterday.setDate(
    yesterday.getDate() - 1
  );


  const yesterdayCount =
    await generateDosesForDate(
      userId,
      yesterday
    );


  const todayCount =
    await generateDosesForDate(
      userId,
      today
    );

  console.log(`[Backend][Dose] Generation finished: ${((performance.now() - totalStart)).toFixed(0)} ms`);

  return {
    created:
      yesterdayCount +
      todayCount,
  };
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {
  generateTodayDoses,
  generateDosesForDate,
  reconcilePendingDosesForSchedule,
  parseTime,
  scheduleAppliesToDate,
};