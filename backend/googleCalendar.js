import { google } from 'googleapis';
import { query, one } from './db.js';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI
  || (process.env.GOOGLE_REDIRECT_URI ? process.env.GOOGLE_REDIRECT_URI.replace('/auth/google/callback', '/auth/google-calendar/callback') : undefined);

export function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && REDIRECT_URI);
}

function newOAuthClient() {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthUrl(ownerName) {
  const client = newOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: ownerName ? encodeURIComponent(ownerName) : undefined,
  });
}

export async function handleOAuthCallback(code, ownerName) {
  const client = newOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token. Revoke prior access at https://myaccount.google.com/permissions and try connecting again.');
  }
  // Only one calendar connection is supported right now — replace any existing one.
  await query('DELETE FROM calendar_connections');
  await query(
    'INSERT INTO calendar_connections (owner_name, calendar_id, refresh_token) VALUES ($1, $2, $3)',
    [ownerName || '', 'primary', tokens.refresh_token]
  );
}

async function getConnection() {
  return one('SELECT * FROM calendar_connections ORDER BY created_at DESC LIMIT 1');
}

export async function isAuthorized() {
  return Boolean(await getConnection());
}

export async function getConnectionInfo() {
  const conn = await getConnection();
  return conn ? { ownerName: conn.owner_name, calendarId: conn.calendar_id } : null;
}

async function getCalendarClient() {
  const conn = await getConnection();
  if (!conn) throw new Error('Google Calendar is not connected. Visit /auth/google-calendar to connect it.');
  const client = newOAuthClient();
  client.setCredentials({ refresh_token: conn.refresh_token });
  return { calendar: google.calendar({ version: 'v3', auth: client }), calendarId: conn.calendar_id };
}

function normalizeEvent(ev) {
  const startRaw = ev.start?.dateTime || ev.start?.date || '';
  const endRaw = ev.end?.dateTime || ev.end?.date || '';
  const allDay = Boolean(ev.start?.date && !ev.start?.dateTime);
  return {
    id: ev.id,
    title: ev.summary || '(No title)',
    description: ev.description || '',
    location: ev.location || '',
    date: startRaw.slice(0, 10),
    time: allDay ? '' : startRaw.slice(11, 16),
    endDate: endRaw.slice(0, 10),
    endTime: allDay ? '' : endRaw.slice(11, 16),
    allDay,
    htmlLink: ev.htmlLink || '',
    recurring: Boolean(ev.recurringEventId),
  };
}

export async function listEvents({ timeMin, timeMax }) {
  const { calendar, calendarId } = await getCalendarClient();
  const res = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  });
  return (res.data.items || []).map(normalizeEvent);
}

function toEventBody({ title, description, location, date, time, endDate, endTime, allDay }) {
  const body = { summary: title, description: description || '', location: location || '' };
  if (allDay || !time) {
    body.start = { date };
    body.end = { date: endDate || date };
  } else {
    body.start = { dateTime: new Date(`${date}T${time}`).toISOString() };
    body.end = { dateTime: new Date(`${endDate || date}T${endTime || time}`).toISOString() };
  }
  return body;
}

export async function createEvent(fields) {
  const { calendar, calendarId } = await getCalendarClient();
  const res = await calendar.events.insert({ calendarId, requestBody: toEventBody(fields) });
  return normalizeEvent(res.data);
}

export async function updateEvent(eventId, fields) {
  const { calendar, calendarId } = await getCalendarClient();
  const res = await calendar.events.patch({ calendarId, eventId, requestBody: toEventBody(fields) });
  return normalizeEvent(res.data);
}

export async function deleteEvent(eventId) {
  const { calendar, calendarId } = await getCalendarClient();
  await calendar.events.delete({ calendarId, eventId });
}
