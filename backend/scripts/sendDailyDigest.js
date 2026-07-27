import 'dotenv/config';
import { sendDailyDigest } from '../dailyDigest.js';

const result = await sendDailyDigest();
console.log(`Daily digest sent for ${result.today}: ${result.taskCount} task(s), ${result.eventCount} event(s).`);
process.exit(0);
