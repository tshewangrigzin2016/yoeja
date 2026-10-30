import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialBackendState,
  filterPrayerEvents,
  resolveBlobAssetFilename,
  recordPrayerProgress,
  createOfferingRecord,
  createPledgeRecord,
  type PrayerEventRecord,
} from './yoeja-backend';

const sampleEvents: PrayerEventRecord[] = [
  {
    id: 'ev-1',
    title: 'Public prayer ceremony',
    title_dz: 'དམངས༌ཀྱི༌སྐུ༌རིམ།',
    starts_at: '2026-05-18T18:00:00.000Z',
    ends_at: '2026-05-19T18:00:00.000Z',
    lunar_start_date: null,
    lunar_end_date: null,
    prayer_type: 'mani',
    mantra: 'Om Mani Padme Hum',
    offering_purpose: 'prosperity_protection',
    image: '/api/v1/files/blobs/proxy/abc/prayer-calendar-03.webp',
  },
  {
    id: 'ev-2',
    title: 'Medicine Buddha ritual',
    title_dz: null,
    starts_at: '2026-10-10T18:00:00.000Z',
    ends_at: '2026-10-12T18:00:00.000Z',
    lunar_start_date: null,
    lunar_end_date: null,
    prayer_type: 'medicine',
    mantra: 'Tayatha Om Bekandze',
    offering_purpose: 'health_wellbeing',
    image: '/api/v1/files/blobs/proxy/def/prayer-calendar-06-v2.webp',
  },
];

test('filterPrayerEvents filters by date range and offeringPurpose', () => {
  const all = filterPrayerEvents(sampleEvents);
  assert.equal(all.prayer_events.length, 2);
  assert.equal(all.prayer_events[0].slug, 'public-prayer-ceremony');
  assert.equal(all.prayer_events[0].location, 'Tashichho Dzong');

  const healthOnly = filterPrayerEvents(sampleEvents, {
    offeringPurpose: 'health_wellbeing',
  });
  assert.equal(healthOnly.prayer_events.length, 1);
  assert.equal(healthOnly.prayer_events[0].id, 'ev-2');

  const octoberOnly = filterPrayerEvents(sampleEvents, {
    startsFrom: '2026-10-01',
    startsTo: '2026-10-31',
  });
  assert.equal(octoberOnly.prayer_events.length, 1);
  assert.equal(octoberOnly.prayer_events[0].id, 'ev-2');
});

test('resolveBlobAssetFilename maps Rails ActiveStorage blob filename to hashed Vite asset', () => {
  const assets = [
    'prayer-calendar-01-ypgujItE.webp',
    'prayer-calendar-03-__zuI5hL.webp',
    'prayer-calendar-06-v2-DxhlG9Gy.webp',
  ];

  assert.equal(
    resolveBlobAssetFilename('prayer-calendar-03.webp', assets),
    'prayer-calendar-03-__zuI5hL.webp'
  );
  assert.equal(
    resolveBlobAssetFilename('prayer-calendar-06-v2.webp', assets),
    'prayer-calendar-06-v2-DxhlG9Gy.webp'
  );
  assert.equal(resolveBlobAssetFilename('nonexistent.webp', assets), null);
});

test('recordPrayerProgress increments global and user prayer counts monotonically', () => {
  const state = createInitialBackendState(1000);
  const step1 = recordPrayerProgress(state, 'session-1', 12, false);
  assert.equal(step1.accepted_count, 12);
  assert.equal(step1.user_total, 12);
  assert.equal(state.allTimeBlessingsTotal, 1012);
  assert.equal(step1.ended_at, null);

  const step2 = recordPrayerProgress(state, 'session-1', 27, true);
  assert.equal(step2.accepted_count, 27);
  assert.equal(step2.user_total, 27);
  assert.equal(state.allTimeBlessingsTotal, 1027);
  assert.ok(step2.ended_at !== null);
});

test('createOfferingRecord and createPledgeRecord validate inputs and store records', () => {
  const state = createInitialBackendState();

  assert.throws(() =>
    createOfferingRecord(state, { amount: 0, donor_name: 'Karma' })
  );
  assert.throws(() =>
    createOfferingRecord(state, { amount: 108, donor_name: '   ' })
  );

  const offering = createOfferingRecord(state, {
    amount: 108,
    donor_name: 'Tashi Dorji',
    donor_email: 'tashi@example.com',
    offering_purpose: 'all_beings',
    prayer_for: 'All sentient beings',
    message: 'May peace prevail',
  });

  assert.equal(offering.amount, '108.00');
  assert.equal(offering.donor_name, 'Tashi Dorji');
  assert.equal(offering.status, 'succeeded');
  assert.equal(state.offerings.get(offering.id)?.reference, offering.reference);

  const pledge = createPledgeRecord(state, {
    donor_name: 'Pema Choden',
    donor_email: 'pema@example.com',
    phone_number: '+97517112233',
    dzongkhag: 'Thimphu',
    dedication: 'Butter lamps for Punakha Dzong',
  });
  assert.equal(pledge.donor_name, 'Pema Choden');
  assert.equal(state.pledges.get(pledge.id)?.reference, pledge.reference);
});
