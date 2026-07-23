import { google } from 'googleapis';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { Readable } from 'stream';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = join(__dirname, 'google-token.json');

const SCOPES = ['https://www.googleapis.com/auth/drive'];

function loadStoredRefreshToken() {
  if (existsSync(TOKEN_PATH)) {
    try {
      return JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')).refresh_token || null;
    } catch {
      return null;
    }
  }
  return null;
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const storedRefreshToken = process.env.GOOGLE_REFRESH_TOKEN || loadStoredRefreshToken();
if (storedRefreshToken) {
  oauth2Client.setCredentials({ refresh_token: storedRefreshToken });
}

export function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

export function isAuthorized() {
  return Boolean(oauth2Client.credentials.refresh_token);
}

export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

export async function handleOAuthCallback(code) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  if (tokens.refresh_token) {
    writeFileSync(TOKEN_PATH, JSON.stringify({ refresh_token: tokens.refresh_token }, null, 2));
  }
}

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Parent folder that project folders are created inside.
const PROJECTS_ROOT_ID = process.env.GOOGLE_DRIVE_PROJECTS_ROOT_ID || '1CI1aOrDyaWzf8mwKi_QacnfhZrRZAvcT';
// Parent folder that the Drive Files page browses/syncs from — kept separate so
// arbitrary folders/files added there never turn into Projects automatically.
const FILES_ROOT_ID = process.env.GOOGLE_DRIVE_FILES_ROOT_ID || '1cv0Mz_69aX4-7QJZphQ6_VOo16BGRWfd';

const folderCache = new Map();

async function findFolder(name, parentId) {
  const parentClause = parentId ? `and '${parentId}' in parents` : "and 'root' in parents";
  const res = await drive.files.list({
    q: `mimeType = 'application/vnd.google-apps.folder' and name = '${name.replace(/'/g, "\\'")}' and trashed = false ${parentClause}`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  return res.data.files?.[0]?.id || null;
}

async function createFolder(name, parentId) {
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: 'id',
  });
  return created.data.id;
}

export async function getOrCreateProjectFolder(projectName) {
  const key = projectName || '__unfiled__';
  if (folderCache.has(key)) return folderCache.get(key);

  const folderName = projectName || 'Unfiled';

  const existingId = await findFolder(folderName, PROJECTS_ROOT_ID);
  const folderId = existingId || await createFolder(folderName, PROJECTS_ROOT_ID);

  folderCache.set(key, folderId);
  return folderId;
}

export async function createFolderIn(name, parentId) {
  return createFolder(name, parentId);
}

export async function renameProjectFolder(folderId, newName) {
  await drive.files.update({ fileId: folderId, requestBody: { name: newName } });
}

export async function trashFolder(folderId) {
  await drive.files.update({ fileId: folderId, requestBody: { trashed: true } });
}

export function invalidateProjectFolderCache(projectName) {
  folderCache.delete(projectName || '__unfiled__');
}

export async function uploadFile({ buffer, originalName, mimeType, project, driveFolderId }) {
  const parentId = driveFolderId || await getOrCreateProjectFolder(project);
  const res = await drive.files.create({
    requestBody: { name: originalName, parents: [parentId] },
    media: { mimeType: mimeType || 'application/octet-stream', body: Readable.from(buffer) },
    fields: 'id, webViewLink, webContentLink',
  });
  return { driveFileId: res.data.id, driveLink: res.data.webViewLink };
}

export async function downloadFileStream(driveFileId) {
  const res = await drive.files.get({ fileId: driveFileId, alt: 'media' }, { responseType: 'stream' });
  return res.data;
}

export async function deleteFile(driveFileId) {
  try {
    await drive.files.delete({ fileId: driveFileId });
  } catch {}
}

export async function listChildFolders(parentId) {
  const res = await drive.files.list({
    q: `mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${parentId}' in parents`,
    fields: 'files(id, name)',
    spaces: 'drive',
    pageSize: 1000,
  });
  return res.data.files || [];
}

export async function listChildFiles(parentId) {
  const res = await drive.files.list({
    q: `mimeType != 'application/vnd.google-apps.folder' and trashed = false and '${parentId}' in parents`,
    fields: 'files(id, name, mimeType, size, webViewLink)',
    spaces: 'drive',
    pageSize: 1000,
  });
  return res.data.files || [];
}

export async function getFilesRoot() {
  return FILES_ROOT_ID;
}

export async function getProjectsRoot() {
  return PROJECTS_ROOT_ID;
}

export async function findChildFolderByName(parentId, name) {
  return findFolder(name, parentId);
}
