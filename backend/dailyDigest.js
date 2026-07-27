import { Resend } from 'resend';
import { query } from './db.js';
import * as googleCalendar from './googleCalendar.js';

function todayString() {
  const tz = process.env.DIGEST_TIMEZONE || 'UTC';
  return new Date().toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
}

async function getTodaysTasks(today) {
  const rows = await query('SELECT * FROM tasks WHERE status != $1 ORDER BY priority', ['done']);
  return rows.filter((t) => (t.due || '').slice(0, 10) === today);
}

async function getTodaysEvents(today) {
  if (!(await googleCalendar.isAuthorized())) return [];
  const timeMin = `${today}T00:00:00Z`;
  const timeMax = `${today}T23:59:59Z`;
  const events = await googleCalendar.listEvents({ timeMin, timeMax });
  return events.filter((e) => e.date === today);
}

function renderEmailHtml({ today, tasks, events }) {
  const taskRows = tasks.length
    ? tasks.map((t) => `<li><strong>${t.title}</strong> — ${t.priority} priority${t.project ? ` · ${t.project}` : ''}${t.owner ? ` · ${t.owner}` : ''}</li>`).join('')
    : '<li>No tasks due today.</li>';

  const eventRows = events.length
    ? events.map((e) => `<li>${e.allDay ? 'All day' : e.time}${e.title ? ` — ${e.title}` : ''}</li>`).join('')
    : '<li>No calendar events today.</li>';

  return `
    <h2>Today's schedule — ${today}</h2>
    <h3>Tasks due today</h3>
    <ul>${taskRows}</ul>
    <h3>Calendar events</h3>
    <ul>${eventRows}</ul>
  `;
}

export async function sendDailyDigest() {
  const today = todayString();
  const [tasks, events] = await Promise.all([getTodaysTasks(today), getTodaysEvents(today)]);

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.DIGEST_FROM_EMAIL,
    to: process.env.DIGEST_TO_EMAIL,
    subject: `Today's tasks & schedule — ${today}`,
    html: renderEmailHtml({ today, tasks, events }),
  });

  return { today, taskCount: tasks.length, eventCount: events.length };
}
