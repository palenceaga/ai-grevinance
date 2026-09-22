const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:8712@localhost:5432/grievance_portal_db';

const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected idle client error:', err.message);
});

/**
 * Auto-initialize database tables and seed initial demo data
 */
async function initDb() {
  const client = await pool.connect();
  try {
    console.log('[PostgreSQL] Connected to database. Ensuring tables exist...');

    // 1. Citizens Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS citizens (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        mobile VARCHAR(15) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        state VARCHAR(50) NOT NULL,
        category VARCHAR(50) NOT NULL,
        aadhaar_hash VARCHAR(64) NOT NULL,
        aadhaar_masked VARCHAR(20) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Officials Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS officials (
        id SERIAL PRIMARY KEY,
        officer_id VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        department VARCHAR(100) NOT NULL,
        security_pin VARCHAR(20) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Grievances Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS grievances (
        id SERIAL PRIMARY KEY,
        docket_no VARCHAR(50) UNIQUE NOT NULL,
        citizen_id INTEGER REFERENCES citizens(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        department VARCHAR(100) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'Site Inspection in Progress',
        assigned_officer VARCHAR(255) DEFAULT 'Executive Engineer, Zone 4',
        timeline_step INTEGER DEFAULT 3,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Seed Demo Nodal Officer if not exists
    const officerCheck = await client.query('SELECT id FROM officials WHERE officer_id = $1', ['EMP-99402']);
    if (officerCheck.rowCount === 0) {
      const hashedOfficerPwd = await bcrypt.hash('Officer@2026!', 10);
      await client.query(`
        INSERT INTO officials (officer_id, email, department, security_pin, password_hash)
        VALUES ($1, $2, $3, $4, $5);
      `, ['EMP-99402', 'officer@nic.in', 'revenue', '482910', hashedOfficerPwd]);
      console.log('[PostgreSQL] Seeded demo official: EMP-99402 (officer@nic.in / Officer@2026!)');
    }

    // 5. Seed Demo Citizens if not exist
    const user1Check = await client.query('SELECT id FROM citizens WHERE mobile = $1', ['9812345678']);
    if (user1Check.rowCount === 0) {
      const hashedUser1Pwd = await bcrypt.hash('User@2026!', 10);
      const crypto = require('crypto');
      const aadhaarHash1 = crypto.createHash('sha256').update('998877665544').digest('hex');
      await client.query(`
        INSERT INTO citizens (full_name, mobile, email, state, category, aadhaar_hash, aadhaar_masked, password_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `, [
        'Priya Sharma',
        '9812345678',
        'user@jansamadhan.in',
        'Delhi NCR',
        'Individual Citizen',
        aadhaarHash1,
        'XXXX XXXX 7721',
        hashedUser1Pwd
      ]);
      console.log('[PostgreSQL] Seeded demo citizen: Priya Sharma (user@jansamadhan.in / User@2026!)');
    }

    const citizenCheck = await client.query('SELECT id FROM citizens WHERE mobile = $1', ['9876543210']);
    if (citizenCheck.rowCount === 0) {
      const hashedCitizenPwd = await bcrypt.hash('Citizen@2026!', 10);
      const crypto = require('crypto');
      const aadhaarHash = crypto.createHash('sha256').update('548921044920').digest('hex');
      await client.query(`
        INSERT INTO citizens (full_name, mobile, email, state, category, aadhaar_hash, aadhaar_masked, password_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `, [
        'Rajesh Kumar Sharma',
        '9876543210',
        'rajesh.sharma@example.com',
        'Delhi NCR',
        'Individual Citizen',
        aadhaarHash,
        'XXXX XXXX 4920',
        hashedCitizenPwd
      ]);
      console.log('[PostgreSQL] Seeded demo citizen: Rajesh Kumar Sharma (9876543210 / Citizen@2026!)');
    }

    // 6. Seed Demo Grievances if empty or fewer than 50
    const countCheck = await client.query('SELECT count(*) FROM grievances');
    if (parseInt(countCheck.rows[0].count, 10) < 50) {
      const { SEED_GRIEVANCES } = require('./complaints-data');
      const userRes = await client.query('SELECT id FROM citizens WHERE email = $1 LIMIT 1', ['user@jansamadhan.in']);
      const citizenId = userRes.rowCount > 0 ? userRes.rows[0].id : null;
      for (const g of SEED_GRIEVANCES) {
        let timelineStep = 1;
        if (g.status === 'Resolved') timelineStep = 4;
        else if (g.status === 'In Progress') timelineStep = 2;
        await client.query(`
          INSERT INTO grievances (docket_no, citizen_id, title, category, department, description, status, assigned_officer, timeline_step, priority, location)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (docket_no) DO NOTHING;
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
      console.log(`[PostgreSQL] Seeded ${SEED_GRIEVANCES.length} demo grievances.`);
    }

    console.log('[PostgreSQL] Database initialization completed successfully.');
  } catch (err) {
    console.error('[PostgreSQL] Error during database initialization:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDb,
};
