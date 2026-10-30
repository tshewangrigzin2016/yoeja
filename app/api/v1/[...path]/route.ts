import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import seedData from '@/lib/seed-prayer-events.json';
import {
  createInitialBackendState,
  filterPrayerEvents,
  normalizePrayerEvent,
  resolveBlobAssetFilename,
  recordPrayerProgress,
  createOfferingRecord,
  createPledgeRecord,
  type PrayerEventRecord,
  type YoejaBackendState,
} from '@/lib/yoeja-backend';

declare global {
  var __YOEJA_BACKEND_STATE__: YoejaBackendState | undefined;
}

function getState(): YoejaBackendState {
  if (!globalThis.__YOEJA_BACKEND_STATE__) {
    globalThis.__YOEJA_BACKEND_STATE__ = createInitialBackendState(137016684);
  }
  return globalThis.__YOEJA_BACKEND_STATE__;
}

const seedEvents: PrayerEventRecord[] = (
  (seedData as { prayer_events?: PrayerEventRecord[] }).prayer_events ?? []
).map(normalizePrayerEvent);

function getPublicAssetsList(): string[] {
  try {
    return fs.readdirSync(path.join(process.cwd(), 'public', 'assets'));
  } catch {
    return [];
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  const route = '/' + (segments ?? []).join('/');
  const state = getState();

  // 1. CSRF Token
  if (route === '/app/auth/csrf') {
    const res = NextResponse.json({ csrf_token: 'yoeja-csrf-token-2026' });
    res.cookies.set('XSRF-TOKEN', 'yoeja-csrf-token-2026', { path: '/' });
    return res;
  }

  // 2. System configuration
  if (route === '/app/system_configuration') {
    return NextResponse.json({
      system_configuration: {
        max_offering_amount_btn: null,
        max_offering_amount_usd: null,
        receipt_email_enabled: true,
      },
    });
  }

  // 3. Global prayer stats (live incrementing counter)
  if (route === '/app/prayer_stats/global') {
    state.allTimeBlessingsTotal += Math.floor(Math.random() * 5) + 1;
    return NextResponse.json({
      prayer_stats: {
        total: state.userPrayerTotal,
        prayer_site_reported_total: 0,
        all_time_total: state.allTimeBlessingsTotal,
        as_of: new Date().toISOString(),
        prayer_event: 'tashichho-57',
        prayer_event_title: 'Fire ritual',
        prayer_event_location: 'Tashichho Dzong',
        starts_at: '2026-10-31T18:00:00Z',
        ends_at: '2026-11-01T18:00:00Z',
        timezone: 'Asia/Thimphu',
      },
    });
  }

  // 4. User prayer stats
  if (route === '/app/me/prayer_stats') {
    const sessions = Array.from(state.prayerSessions.values()).reverse();
    return NextResponse.json({
      prayer_stats: {
        total: state.userPrayerTotal,
        recent_prayer_rooms: sessions,
      },
      meta: {
        next_cursor: null,
      },
    });
  }

  // 5. Auth session & guest session
  if (route === '/app/auth/sessions') {
    if (!state.currentUser) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json({ user: state.currentUser });
  }

  if (route === '/app/auth/guest_session') {
    return NextResponse.json({
      guest_session: {
        beads: state.guestBeads,
      },
    });
  }

  if (route.startsWith('/app/auth/registration/')) {
    const token = decodeURIComponent(route.replace('/app/auth/registration/', ''));
    return NextResponse.json({
      registration: {
        email: token.includes('@') ? token : 'devotee@yoeja.com',
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      },
    });
  }

  // 6. Prayer events list & single event
  if (route === '/app/prayer_events') {
    const sp = req.nextUrl.searchParams;
    const startsFrom = sp.get('starts_from');
    const startsTo = sp.get('starts_to');
    const offeringPurposes = sp.getAll('offering_purpose[]');
    const page = Number(sp.get('page') || 1);
    const perPage = Number(sp.get('per_page') || 100);

    const result = filterPrayerEvents(seedEvents, {
      startsFrom,
      startsTo,
      offeringPurpose: offeringPurposes.length > 0 ? offeringPurposes : sp.get('offering_purpose'),
      page,
      perPage,
    });
    return NextResponse.json(result);
  }

  if (route.startsWith('/app/prayer_events/')) {
    const idOrSlug = decodeURIComponent(route.replace('/app/prayer_events/', ''));
    const found =
      seedEvents.find((e) => e.id === idOrSlug || e.slug === idOrSlug) ??
      seedEvents[0];
    if (!found) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Prayer event not found' } },
        { status: 404 }
      );
    }
    return NextResponse.json({ prayer_event: normalizePrayerEvent(found) });
  }

  // 7. Saved prayer events
  if (route === '/portal/saved_prayer_events') {
    const saved = Array.from(state.savedPrayerEventIds)
      .map((id) => {
        const ev = seedEvents.find((e) => e.id === id);
        if (!ev) return null;
        return {
          prayer_event_id: id,
          saved_at: new Date().toISOString(),
          prayer_event: normalizePrayerEvent(ev),
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      saved_prayer_events: saved,
      meta: { next_page: null, total: saved.length },
    });
  }

  // 8. Offerings (single & portal list)
  if (route.startsWith('/app/offerings/')) {
    const rest = route.replace('/app/offerings/', '');
    const parts = rest.split('/');
    const offeringId = decodeURIComponent(parts[0]);
    const existing = state.offerings.get(offeringId);
    if (existing) {
      return NextResponse.json({ offering: existing });
    }
    // Synthesize a deterministic offering if navigated directly
    const fallback = createOfferingRecord(state, {
      amount: 108,
      donor_name: 'Dedicated Devotee',
      offering_purpose: 'all_beings',
      prayer_for: 'All sentient beings',
      message: 'Dedicated to the Unbroken Prayer',
    });
    fallback.id = offeringId;
    state.offerings.set(offeringId, fallback);
    return NextResponse.json({ offering: fallback });
  }

  if (route === '/portal/offerings') {
    const list = Array.from(state.offerings.values()).reverse();
    return NextResponse.json({
      offerings: list,
      meta: { next_page: null, total: list.length },
    });
  }

  // 9. ActiveStorage blob proxy -> local /public/assets/*.webp
  if (route.startsWith('/files/blobs/proxy/')) {
    const requestedFile = segments[segments.length - 1] || '';
    const matchedAsset = resolveBlobAssetFilename(
      requestedFile,
      getPublicAssetsList()
    );
    if (matchedAsset) {
      const filePath = path.join(process.cwd(), 'public', 'assets', matchedAsset);
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        return new NextResponse(buf, {
          status: 200,
          headers: {
            'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    }
  }

  return NextResponse.json({});
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  const route = '/' + (segments ?? []).join('/');
  const state = getState();

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // 1. Guest session start
  if (route === '/app/auth/guest_session') {
    return NextResponse.json({
      guest_session: {
        beads: state.guestBeads,
      },
    });
  }

  // 2. User Sign In
  if (route === '/app/auth/sessions') {
    const u = body?.user ?? {};
    const email = u.email || 'devotee@yoeja.com';
    const firstName = email.split('@')[0] || 'Tashi';
    state.currentUser = {
      id: 'usr_yoeja_108',
      email,
      phone_number: u.phone_number ?? null,
      role: 'member',
      newsletter_subscribed: true,
      profile: {
        first_name: firstName.charAt(0).toUpperCase() + firstName.slice(1),
        last_name: '',
        bead_type: state.guestBeads.bead_type,
        bead_color: state.guestBeads.bead_color,
        saved_prayer_reminders: true,
        preferred_language: 'en',
      },
    };
    return NextResponse.json({ user: state.currentUser });
  }

  // 3. Registration & Sign Up
  if (route === '/app/auth/registration') {
    return NextResponse.json({
      message: 'Check your inbox for a sign-up link.',
    });
  }

  if (route === '/app/auth/sign_up') {
    const u = body?.user ?? {};
    const prof = u.profile_attributes ?? {};
    state.currentUser = {
      id: 'usr_yoeja_108',
      email: 'devotee@yoeja.com',
      phone_number: null,
      role: 'member',
      newsletter_subscribed: true,
      profile: {
        first_name: prof.first_name || 'Devotee',
        last_name: prof.last_name || '',
        bead_type: state.guestBeads.bead_type,
        bead_color: state.guestBeads.bead_color,
        saved_prayer_reminders: true,
        preferred_language: 'en',
      },
    };
    return NextResponse.json({ user: state.currentUser });
  }

  if (route === '/app/auth/password') {
    return NextResponse.json({
      message: 'Password reset instructions sent.',
    });
  }

  // 4. Prayer room end session
  if (route.startsWith('/app/prayer_rooms/') && route.endsWith('/end')) {
    const sessionId = decodeURIComponent(
      route.replace('/app/prayer_rooms/', '').replace(/\/end$/, '')
    );
    const progress = recordPrayerProgress(
      state,
      sessionId,
      Number(body?.count ?? 0),
      true
    );
    return NextResponse.json({ progress });
  }

  // 5. Create Offering
  if (route === '/app/offerings') {
    try {
      const offering = createOfferingRecord(state, body?.offering ?? {});
      return NextResponse.json({ offering }, { status: 201 });
    } catch (err: any) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_error',
            message: err?.message || 'Invalid offering details',
          },
        },
        { status: 422 }
      );
    }
  }

  // 6. Payment transaction start / debit / returned
  if (route.startsWith('/app/payment/')) {
    // e.g. /app/payment/:gateway/offerings/:offeringId/payment_transactions
    const parts = route.split('/').filter(Boolean);
    const offeringId = parts[4] || 'off_default';
    const existing = state.offerings.get(offeringId);
    const amount = existing?.amount ?? '108.00';
    const currency = existing?.currency ?? 'USD';
    const txId = `tx_${Date.now()}`;

    return NextResponse.json({
      payment_transaction: {
        id: txId,
        offering_id: offeringId,
        status: 'succeeded',
        expires_at: new Date(Date.now() + 1800_000).toISOString(),
        created_at: new Date().toISOString(),
        otp_required: false,
        checkout_url: `/offerings/${encodeURIComponent(offeringId)}`,
        qr_code_url: null,
        remitter_bank: body?.payment_transaction?.remitter_bank ?? null,
        remitter_account_name: 'Yoeja Devotee',
        attempts_left: 3,
        verifying: false,
        needs_review: false,
        reference: existing?.reference ?? 'YOJ-2026-100001',
        amount,
        fee_amount: '0.00',
        fee_breakdown: null,
        total_amount: amount,
        currency,
      },
    });
  }

  // 7. Create In-Kind Pledge
  if (route === '/app/pledges') {
    try {
      const pledge = createPledgeRecord(state, body?.pledge ?? {});
      return NextResponse.json({ pledge }, { status: 201 });
    } catch (err: any) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_error',
            message: err?.message || 'Invalid pledge details',
          },
        },
        { status: 422 }
      );
    }
  }

  // 8. Contact message
  if (route === '/app/contact_messages') {
    const cm = body?.contact_message ?? {};
    state.contactMessages.push({
      id: `msg_${Date.now()}`,
      name: cm.name || '',
      email: cm.email || '',
      message: cm.message || '',
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({ status: 'ok' }, { status: 201 });
  }

  // 9. Newsletter subscription
  if (route === '/app/newsletter_subscriptions') {
    const sub = body?.newsletter_subscription ?? {};
    if (sub.email) {
      state.newsletterSubscribers.add(sub.email);
    }
    return NextResponse.json({ status: 'ok' }, { status: 201 });
  }

  return NextResponse.json({ status: 'ok' });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  const route = '/' + (segments ?? []).join('/');
  const state = getState();

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // 1. Prayer room progress update
  if (route.startsWith('/app/prayer_rooms/') && route.endsWith('/progress')) {
    const sessionId = decodeURIComponent(
      route.replace('/app/prayer_rooms/', '').replace(/\/progress$/, '')
    );
    const progress = recordPrayerProgress(
      state,
      sessionId,
      Number(body?.count ?? 0),
      Boolean(body?.final)
    );
    return NextResponse.json({ progress });
  }

  // 2. Save prayer event
  if (route.startsWith('/portal/saved_prayer_events/')) {
    const eventId = decodeURIComponent(
      route.replace('/portal/saved_prayer_events/', '')
    );
    state.savedPrayerEventIds.add(eventId);
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ status: 'ok' });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  const route = '/' + (segments ?? []).join('/');
  const state = getState();

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (route === '/app/auth/guest_session') {
    const beads = body?.guest_session?.beads;
    if (beads) {
      state.guestBeads = {
        bead_type: beads.bead_type ?? state.guestBeads.bead_type,
        bead_color: beads.bead_color ?? state.guestBeads.bead_color,
      };
    }
    return NextResponse.json({
      guest_session: {
        beads: state.guestBeads,
      },
    });
  }

  if (route === '/portal/user') {
    const u = body?.user ?? {};
    const prof = u.profile_attributes ?? {};
    if (state.currentUser) {
      state.currentUser = {
        ...state.currentUser,
        newsletter_subscribed:
          u.newsletter_subscribed ?? state.currentUser.newsletter_subscribed,
        profile: {
          ...state.currentUser.profile,
          first_name: prof.first_name ?? state.currentUser.profile.first_name,
          last_name: prof.last_name ?? state.currentUser.profile.last_name,
          bead_type: prof.bead_type ?? state.currentUser.profile.bead_type,
          bead_color: prof.bead_color ?? state.currentUser.profile.bead_color,
          saved_prayer_reminders:
            prof.saved_prayer_reminders ??
            state.currentUser.profile.saved_prayer_reminders,
          preferred_language:
            prof.preferred_language ??
            state.currentUser.profile.preferred_language,
        },
      };
    }
    return NextResponse.json({ user: state.currentUser });
  }

  return NextResponse.json({ status: 'ok' });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  const route = '/' + (segments ?? []).join('/');
  const state = getState();

  if (route === '/app/auth/sessions' || route === '/portal/user') {
    state.currentUser = null;
    return new NextResponse(null, { status: 204 });
  }

  if (route.startsWith('/portal/saved_prayer_events/')) {
    const eventId = decodeURIComponent(
      route.replace('/portal/saved_prayer_events/', '')
    );
    state.savedPrayerEventIds.delete(eventId);
    return new NextResponse(null, { status: 204 });
  }

  return new NextResponse(null, { status: 204 });
}
