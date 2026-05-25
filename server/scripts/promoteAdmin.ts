/**
 * Promote a user to admin by email.
 * Usage: tsx server/scripts/promoteAdmin.ts <email>
 * (run from the server workspace: `npx tsx scripts/promoteAdmin.ts you@example.com`)
 */
import { eq } from 'drizzle-orm';
import { db, pool } from '../src/db/index.js';
import { users } from '../src/db/schema.js';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: tsx scripts/promoteAdmin.ts <email>');
    process.exit(1);
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.error(`No user found with email: ${email}`);
    await pool.end();
    process.exit(1);
  }

  await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id));
  console.log(`Promoted ${email} (id ${user.id}) to admin.`);
  await pool.end();
}

main().catch(async (err) => {
  console.error('promoteAdmin failed:', err);
  process.exit(1);
});
