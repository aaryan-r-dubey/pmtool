import Anthropic from '@anthropic-ai/sdk';
import { query, one } from './db.js';
import * as googleCalendar from './googleCalendar.js';

const MODEL = process.env.CHAT_MODEL || 'claude-opus-5';

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

export function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM_PROMPT = `You are the assistant built into "TeamSpace", an internal project management tool for Urban Futures Lab.
You can help find files that were uploaded to the tool (even from a vague or partial description of the filename), and you can create calendar events or tasks when asked.
When you find files, briefly tell the user what you found — the file list itself is already shown to them separately, so don't repeat every filename verbatim in your reply.
When you create a calendar event or task, confirm what you created in one short sentence.
Keep replies brief — a sentence or two, not a report.`;

const TOOLS = [
  {
    name: 'find_files',
    description: 'Search for files uploaded to the PM tool by a vague, partial, or fuzzy description of the filename (not necessarily exact). Matches against filename, project, and folder name.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words describing the file — can be partial, out of order, or approximate.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_calendar_event',
    description: "Create an event on the connected Google Calendar. Use this when the user asks to schedule a meeting or add something to the calendar.",
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        time: { type: 'string', description: 'HH:MM 24-hour start time, omit for an all-day event' },
        endTime: { type: 'string', description: 'HH:MM 24-hour end time, defaults to start time + nothing if omitted' },
        description: { type: 'string' },
        location: { type: 'string' },
        allDay: { type: 'boolean' },
      },
      required: ['title', 'date'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a task in the PM tool.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        owner: { type: 'string' },
        project: { type: 'string' },
        due: { type: 'string', description: 'YYYY-MM-DD' },
        description: { type: 'string' },
      },
      required: ['title'],
    },
  },
];

function scoreFile(tokens, file) {
  const haystack = `${file.original_name} ${file.project || ''} ${file.folder_name || ''}`.toLowerCase();
  return tokens.filter(t => haystack.includes(t)).length;
}

async function findFiles(input) {
  const tokens = String(input.query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { matches: [] };
  const files = await query(`
    SELECT f.id, f.original_name, f.project, f.drive_link, f.mime_type, fo.name AS folder_name
    FROM files f LEFT JOIN folders fo ON f.folder_id = fo.id
    ORDER BY f.created_at DESC
  `);
  const scored = files
    .map(f => ({ file: f, score: scoreFile(tokens, f) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(s => s.file);
  return { matches: scored };
}

async function createCalendarEvent(input) {
  const event = await googleCalendar.createEvent({
    title: input.title,
    description: input.description || '',
    location: input.location || '',
    date: input.date,
    time: input.allDay ? '' : (input.time || ''),
    endDate: input.date,
    endTime: input.allDay ? '' : (input.endTime || input.time || ''),
    allDay: Boolean(input.allDay),
  });
  return { created: true, event };
}

async function createTask(input) {
  const task = await one(
    'INSERT INTO tasks (title, status, priority, owner, project, due, description) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [input.title, 'todo', input.priority || 'medium', input.owner || '', input.project || '', input.due || '', input.description || '']
  );
  return { created: true, task };
}

async function executeTool(name, input) {
  if (name === 'find_files') return findFiles(input);
  if (name === 'create_calendar_event') return createCalendarEvent(input);
  if (name === 'create_task') return createTask(input);
  return { error: `Unknown tool: ${name}` };
}

export async function runChat(history) {
  const anthropic = getClient();
  const messages = history.map(m => ({ role: m.role, content: m.content }));
  let fileResults = null;

  for (let i = 0; i < 6; i++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason !== 'tool_use') {
      const reply = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      return { reply, fileResults };
    }

    messages.push({ role: 'assistant', content: response.content });
    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      const result = await executeTool(block.name, block.input);
      if (block.name === 'find_files') fileResults = result.matches;
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return { reply: "Sorry, I couldn't finish that — try rephrasing.", fileResults };
}
