const { pool } = require('./db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { SEED_GRIEVANCES, SEED_USERS } = require('./complaints-data');

async function seedDatabase() {
  const client = await pool.connect();
  try {
    console.log('[Seed] Starting database migration & seeding...');

    // 1. Ensure required columns exist on grievances table
    await client.query(`
      ALTER TABLE grievances ADD COLUMN IF NOT EXISTS priority VARCHAR(50);
      ALTER TABLE grievances ADD COLUMN IF NOT EXISTS location VARCHAR(255);
    `);

    // 2. Remove all existing complaints from grievances table
    await client.query('DELETE FROM grievances;');
    console.log('[Seed] Removed all previous complaints from PostgreSQL grievances table.');

    // 3. Upsert / Seed Citizen Users
    // User 1: Priya Sharma (user@jansamadhan.in / User@2026!)
    const user1Aadhaar = '998877665544';
    const user1AadhaarHash = crypto.createHash('sha256').update(user1Aadhaar).digest('hex');
    const user1PwdHash = await bcrypt.hash('User@2026!', 10);

    const user1Res = await client.query(`
      INSERT INTO citizens (full_name, mobile, email, state, category, aadhaar_hash, aadhaar_masked, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (mobile) DO UPDATE SET 
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash
      RETURNING id, full_name, email;
    `, [
      'Priya Sharma',
      '9812345678',
      'user@jansamadhan.in',
      'Delhi NCR',
      'Individual Citizen',
      user1AadhaarHash,
      'XXXX XXXX 7721',
      user1PwdHash
    ]);
    const citizenId = user1Res.rows[0].id;
    console.log(`[Seed] Seeded citizen user: ${user1Res.rows[0].full_name} (${user1Res.rows[0].email}, ID: ${citizenId})`);

    // User 2: Rajesh Kumar Sharma (rajesh.sharma@example.com / Citizen@2026!)
    const user2Aadhaar = '548921044920';
    const user2AadhaarHash = crypto.createHash('sha256').update(user2Aadhaar).digest('hex');
    const user2PwdHash = await bcrypt.hash('Citizen@2026!', 10);

    await client.query(`
      INSERT INTO citizens (full_name, mobile, email, state, category, aadhaar_hash, aadhaar_masked, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (mobile) DO UPDATE SET 
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash
      RETURNING id, full_name, email;
    `, [
      'Rajesh Kumar Sharma',
      '9876543210',
      'rajesh.sharma@example.com',
      'Delhi NCR',
      'Individual Citizen',
      user2AadhaarHash,
      'XXXX XXXX 4920',
      user2PwdHash
    ]);
    console.log(`[Seed] Ensured citizen user: Rajesh Kumar Sharma (9876543210 / Citizen@2026!)`);

    // 4. Seed all 100 complaints into PostgreSQL grievances table
    console.log(`[Seed] Inserting ${SEED_GRIEVANCES.length} complaints into grievances table...`);

    for (const g of SEED_GRIEVANCES) {
      let timelineStep = 1;
      if (g.status === 'Resolved') timelineStep = 4;
      else if (g.status === 'In Progress') timelineStep = 2;

      await client.query(`
        INSERT INTO grievances (
          docket_no,
          citizen_id,
          title,
          category,
          department,
          description,
          status,
          assigned_officer,
          timeline_step,
          priority,
          location
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
      `, [
        g.docket_no,
        citizenId,
        g.title,
        g.category,
        g.category_key,
        g.description,
        g.status,
        g.assigned_officer,
        timelineStep,
        g.priority,
        g.location
      ]);
    }

    const countRes = await client.query('SELECT count(*) FROM grievances');
    console.log(`[Seed] Successfully inserted ${countRes.rows[0].count} grievances into PostgreSQL!`);
    console.log('[Seed] Database seeding completed successfully.');
  } catch (err) {
    console.error('[Seed Error]:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
