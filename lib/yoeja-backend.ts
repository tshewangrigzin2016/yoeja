export interface PrayerEventRecord {
  id: string;
  title: string;
  title_dz: string | null;
  starts_at: string;
  ends_at: string;
  lunar_start_date: string | null;
  lunar_end_date: string | null;
  prayer_type: string;
  mantra: string;
  offering_purpose: string | null;
  image: string | null;
  slug?: string;
  location?: string;
}

export interface OfferingInput {
  amount?: string | number;
  payment_method?: string;
  donor_name?: string;
  donor_email?: string;
  donor_phone_number?: string | null;
  offering_purpose?: string;
  prayer_event_id?: string | null;
  prayer_for?: string | null;
  message?: string | null;
  currency?: string;
}

export interface OfferingRecord {
  id: string;
  reference: string;
  amount: string;
  currency: string;
  payment_method: string;
  status: 'pending' | 'succeeded' | 'failed';
  kyc_required: boolean;
  kyc_check: null;
  expires_at: string;
  donor_name: string;
  donor_email: string;
  donor_phone_number: string | null;
  offering_purpose: string;
  prayer_for: string | null;
  prayer_event_id: string | null;
  message: string | null;
  created_at: string;
  paid_at: string | null;
  receipt_url: string | null;
  latest_payment: {
    id: string;
    status: string;
    verifying: boolean;
    needs_review: boolean;
  } | null;
}

export interface PledgeInput {
  donor_name?: string;
  donor_email?: string;
  phone_number?: string;
  dzongkhag?: string;
  offering_purpose?: string;
  prayer_for?: string | null;
  message?: string | null;
  dedication?: string | null;
}

export interface PledgeRecord {
  id: string;
  reference: string;
  donor_name: string;
  donor_email: string;
  phone_number: string;
  dzongkhag: string;
  offering_purpose: string;
  prayer_for: string | null;
  message: string | null;
  dedication: string | null;
  created_at: string;
}

export interface PrayerRoomSessionRecord {
  id: string;
  count: number;
  mantra: string;
  started_at: string;
  last_flushed_at: string;
  ended_at: string | null;
}

export interface YoejaBackendState {
  allTimeBlessingsTotal: number;
  userPrayerTotal: number;
  prayerSessions: Map<string, PrayerRoomSessionRecord>;
  savedPrayerEventIds: Set<string>;
  offerings: Map<string, OfferingRecord>;
  pledges: Map<string, PledgeRecord>;
  contactMessages: Array<{
    id: string;
    name: string;
    email: string;
    message: string;
    created_at: string;
  }>;
  newsletterSubscribers: Set<string>;
  guestBeads: {
    bead_type: string;
    bead_color: string;
  };
  currentUser: {
    id: string;
    email: string;
    phone_number: string | null;
    role: string;
    newsletter_subscribed: boolean;
    profile: {
      first_name: string;
      last_name: string;
      bead_type: string;
      bead_color: string;
      saved_prayer_reminders: boolean;
      preferred_language: string | null;
    };
  } | null;
}

export function createInitialBackendState(
  initialBlessings = 137016684
): YoejaBackendState {
  return {
    allTimeBlessingsTotal: initialBlessings,
    userPrayerTotal: 0,
    prayerSessions: new Map(),
    savedPrayerEventIds: new Set(),
    offerings: new Map(),
    pledges: new Map(),
    contactMessages: [],
    newsletterSubscribers: new Set(),
    guestBeads: {
      bead_type: 'bodhi',
      bead_color: '#C89D66',
    },
    currentUser: null,
  };
}

export function normalizePrayerEvent(
  event: PrayerEventRecord
): PrayerEventRecord {
  return {
    ...event,
    slug:
      event.slug ||
      event.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    location: event.location || 'Tashichho Dzong',
  };
}

export function filterPrayerEvents(
  events: PrayerEventRecord[],
  options: {
    startsFrom?: string | null;
    startsTo?: string | null;
    offeringPurpose?: string | string[] | null;
    page?: number;
    perPage?: number;
  } = {}
): {
  prayer_events: PrayerEventRecord[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    next_page: number | null;
  };
} {
  const {
    startsFrom,
    startsTo,
    offeringPurpose,
    page = 1,
    perPage = 100,
  } = options;

  const purposes = Array.isArray(offeringPurpose)
    ? offeringPurpose.filter(Boolean)
    : offeringPurpose
      ? [offeringPurpose]
      : [];

  const filtered = events
    .map(normalizePrayerEvent)
    .filter((ev) => {
      if (startsFrom) {
        const eventEnd = Date.parse(ev.ends_at);
        const fromTs = Date.parse(
          startsFrom.includes('T') ? startsFrom : `${startsFrom}T00:00:00Z`
        );
        if (Number.isFinite(fromTs) && eventEnd < fromTs) {
          return false;
        }
      }
      if (startsTo) {
        const eventStart = Date.parse(ev.starts_at);
        const toTs = Date.parse(
          startsTo.includes('T') ? startsTo : `${startsTo}T23:59:59Z`
        );
        if (Number.isFinite(toTs) && eventStart > toTs) {
          return false;
        }
      }
      if (purposes.length > 0) {
        if (!ev.offering_purpose || !purposes.includes(ev.offering_purpose)) {
          return false;
        }
      }
      return true;
    });

  const safePage = Math.max(1, page);
  const safePerPage = Math.max(1, perPage);
  const startIdx = (safePage - 1) * safePerPage;
  const paged = filtered.slice(startIdx, startIdx + safePerPage);
  const nextPage =
    startIdx + safePerPage < filtered.length ? safePage + 1 : null;

  return {
    prayer_events: paged,
    meta: {
      page: safePage,
      per_page: safePerPage,
      total: filtered.length,
      next_page: nextPage,
    },
  };
}

export function resolveBlobAssetFilename(
  requestedBlobName: string,
  availableAssetFilenames: string[]
): string | null {
  const cleanName = requestedBlobName.trim().replace(/^\/+/, '');
  if (!cleanName) return null;

  const dotIdx = cleanName.lastIndexOf('.');
  const base = dotIdx !== -1 ? cleanName.slice(0, dotIdx) : cleanName;
  const ext = dotIdx !== -1 ? cleanName.slice(dotIdx) : '.webp';

  // Exact prefix + 8-char Vite hash match: e.g., prayer-calendar-03 -> prayer-calendar-03-__zuI5hL.webp
  const prefix = `${base}-`;
  const match = availableAssetFilenames.find(
    (file) =>
      file.startsWith(prefix) &&
      file.endsWith(ext) &&
      file.length === prefix.length + 8 + ext.length
  );
  if (match) return match;

  // Fallback prefix match
  const fallback = availableAssetFilenames.find(
    (file) => file.startsWith(prefix) && file.endsWith(ext)
  );
  return fallback ?? null;
}

export function recordPrayerProgress(
  state: YoejaBackendState,
  sessionId: string,
  count: number,
  isFinal = false
): {
  accepted_count: number;
  user_total: number;
  ended_at: string | null;
  next_flush_in_ms: number;
} {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  const nowIso = new Date().toISOString();
  const existing = state.prayerSessions.get(sessionId);
  const previousCount = existing ? existing.count : 0;
  const acceptedCount = Math.max(previousCount, safeCount);
  const delta = Math.max(0, acceptedCount - previousCount);

  state.allTimeBlessingsTotal += delta;
  state.userPrayerTotal += delta;

  const updated: PrayerRoomSessionRecord = {
    id: sessionId,
    count: acceptedCount,
    mantra: existing?.mantra ?? 'Om Mani Padme Hum',
    started_at: existing?.started_at ?? nowIso,
    last_flushed_at: nowIso,
    ended_at: isFinal ? nowIso : existing?.ended_at ?? null,
  };
  state.prayerSessions.set(sessionId, updated);

  return {
    accepted_count: acceptedCount,
    user_total: state.userPrayerTotal,
    ended_at: updated.ended_at,
    next_flush_in_ms: isFinal ? 0 : 5000,
  };
}

export function createOfferingRecord(
  state: YoejaBackendState,
  input: OfferingInput
): OfferingRecord {
  const numAmount = Number(input.amount ?? 0);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    throw new Error('Enter a valid offering amount');
  }
  const donorName = (input.donor_name ?? '').trim();
  if (!donorName) {
    throw new Error('Enter your name');
  }

  const id = `off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const refSuffix = String(100000 + state.offerings.size + 1);
  const reference = `YOJ-2026-${refSuffix}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  const paymentMethod = input.payment_method || 'stripe';
  const currency =
    input.currency || (paymentMethod === 'dk_pull' ? 'BTN' : 'USD');

  const paymentId = `pay_${Date.now()}`;
  const record: OfferingRecord = {
    id,
    reference,
    amount: numAmount.toFixed(2),
    currency,
    payment_method: paymentMethod,
    status: 'succeeded',
    kyc_required: false,
    kyc_check: null,
    expires_at: expiresAt,
    donor_name: donorName,
    donor_email: (input.donor_email ?? 'devotee@yoeja.com').trim(),
    donor_phone_number: input.donor_phone_number ?? null,
    offering_purpose: input.offering_purpose || 'all_beings',
    prayer_for: input.prayer_for ? input.prayer_for.trim() : null,
    prayer_event_id: input.prayer_event_id ?? null,
    message: input.message ? input.message.trim() : null,
    created_at: now.toISOString(),
    paid_at: now.toISOString(),
    receipt_url: null,
    latest_payment: {
      id: paymentId,
      status: 'succeeded',
      verifying: false,
      needs_review: false,
    },
  };

  state.offerings.set(id, record);
  return record;
}

export function createPledgeRecord(
  state: YoejaBackendState,
  input: PledgeInput
): PledgeRecord {
  const donorName = (input.donor_name ?? '').trim();
  if (!donorName) {
    throw new Error('Enter your name');
  }
  const id = `plg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const reference = `YOJ-PLG-${1000 + state.pledges.size + 1}`;
  const record: PledgeRecord = {
    id,
    reference,
    donor_name: donorName,
    donor_email: (input.donor_email ?? '').trim(),
    phone_number: (input.phone_number ?? '').trim(),
    dzongkhag: (input.dzongkhag ?? '').trim(),
    offering_purpose: input.offering_purpose || 'all_beings',
    prayer_for: input.prayer_for ? input.prayer_for.trim() : null,
    message: input.message ? input.message.trim() : null,
    dedication: input.dedication ? input.dedication.trim() : null,
    created_at: new Date().toISOString(),
  };
  state.pledges.set(id, record);
  return record;
}
