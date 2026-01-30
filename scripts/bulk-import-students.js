#!/usr/bin/env node
/**
 * Bulk import existing clients (students) from a CSV file.
 * Creates Supabase Auth users with email confirmed and updates profiles.
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (never commit the service key).
 * Run: node scripts/bulk-import-students.js [path/to/file.csv]
 *
 * CSV columns: email, student_name, phone [, password]
 * - Header row optional (first line starting with "email" is skipped).
 * - student_name is stored as full_name; first/last are derived (first word = first_name, rest = last_name).
 * - If password is omitted, uses BULK_IMPORT_DEFAULT_PASSWORD from .env, or generates one per user and writes to imported-passwords.csv.
 */

const fs = require('fs');
const path = require('path');

// Load .env from project root (parent of scripts/)
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  try {
    require('dotenv').config({ path: envPath });
  } catch (_) {
    // Fallback: load .env manually if dotenv not available
    const envContent = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (match) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qdlzumzkhbnxpkprbuju.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_PASSWORD = process.env.BULK_IMPORT_DEFAULT_PASSWORD;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env');
  console.error('Add it from Supabase Dashboard → Settings → API → service_role (secret).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  const rows = [];
  for (const line of lines) {
    const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
    if (parts.length >= 3) rows.push(parts);
  }
  return rows;
}

/** Derive first_name and last_name from a single "student name" (first word = first, rest = last). */
function nameFromStudentName(studentName) {
  const name = (studentName || '').trim();
  if (!name) return { first_name: null, last_name: null, full_name: null };
  const space = name.indexOf(' ');
  if (space === -1) return { first_name: name, last_name: null, full_name: name };
  return {
    first_name: name.slice(0, space),
    last_name: name.slice(space + 1).trim() || null,
    full_name: name,
  };
}

function isHeader(row) {
  return row[0] && row[0].toLowerCase() === 'email';
}

function randomPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let s = '';
  for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function ensureProfile(userId, { first_name, last_name, phone }) {
  const full_name = [first_name, last_name].filter(Boolean).join(' ') || `${first_name || ''}${last_name || ''}`.trim();
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: first_name || null,
      last_name: last_name || null,
      full_name: full_name || null,
      phone: phone || null,
      role: 'student',
    })
    .eq('id', userId);
  if (error) {
    const { error: insertError } = await supabase.from('profiles').insert({
      id: userId,
      first_name: first_name || null,
      last_name: last_name || null,
      full_name: full_name || null,
      phone: phone || null,
      role: 'student',
    });
    if (insertError) return insertError;
  }
  return null;
}

async function main() {
  const csvPath = process.argv[2] || path.join(__dirname, 'students-import.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    console.error('Usage: node scripts/bulk-import-students.js [path/to/file.csv]');
    console.error('Create students-import.csv with columns: email, student_name, phone [, password]');
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(content);
  if (rows.length === 0) {
    console.error('No data rows in CSV.');
    process.exit(1);
  }

  const skipHeader = isHeader(rows[0]);
  const dataRows = skipHeader ? rows.slice(1) : rows;

  let created = 0;
  let skipped = 0;
  const errors = [];
  const generatedPasswords = [];

  const useDefaultPassword = DEFAULT_PASSWORD && !dataRows.some((r) => r[3]);
  if (!useDefaultPassword && !DEFAULT_PASSWORD && !dataRows.some((r) => r[3])) {
    console.log('No password column and no BULK_IMPORT_DEFAULT_PASSWORD: will generate a password per user and write to imported-passwords.csv');
  }

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const [email, student_name, phone, passwordFromCsv] = row;
    const emailTrim = (email || '').trim().toLowerCase();
    if (!emailTrim) {
      errors.push({ row: i + 2, message: 'Missing email' });
      continue;
    }

    const password =
      (passwordFromCsv && passwordFromCsv.trim()) ||
      DEFAULT_PASSWORD ||
      randomPassword(12);

    if (!passwordFromCsv && !DEFAULT_PASSWORD) {
      generatedPasswords.push({ email: emailTrim, password });
    }

    const { first_name, last_name, full_name } = nameFromStudentName(student_name);

    const { data, error } = await supabase.auth.admin.createUser({
      email: emailTrim,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || emailTrim,
        first_name: first_name || null,
        last_name: last_name || null,
        role: 'student',
      },
    });

    if (error) {
      if (error.message && (error.message.includes('already') || error.message.includes('exists') || error.message.includes('registered'))) {
        skipped++;
        const { data: list } = await supabase.auth.admin.listUsers();
        const existing = list?.users?.find((u) => u.email === emailTrim);
        if (existing?.id) {
          const profileErr = await ensureProfile(existing.id, {
            first_name,
            last_name,
            phone: (phone || '').trim(),
          });
          if (profileErr) errors.push({ row: i + 2, email: emailTrim, message: 'Profile update: ' + profileErr.message });
        }
      } else {
        errors.push({ row: i + 2, email: emailTrim, message: error.message });
      }
      continue;
    }

    if (data?.user?.id) {
      await new Promise((r) => setTimeout(r, 500));
      const profileErr = await ensureProfile(data.user.id, {
        first_name,
        last_name,
        phone: (phone || '').trim(),
      });
      if (profileErr) {
        errors.push({ row: i + 2, email: emailTrim, message: 'Profile: ' + profileErr.message });
      } else {
        created++;
      }
    }
  }

  console.log('Done.');
  console.log('Created:', created);
  console.log('Skipped (already existed):', skipped);
  if (errors.length) {
    console.log('Errors:', errors.length);
    errors.forEach((e) => console.error('  ', e.row, e.email || '', e.message));
  }

  if (generatedPasswords.length) {
    const outPath = path.join(path.dirname(csvPath), 'imported-passwords.csv');
    const lines = ['email,password', ...generatedPasswords.map((p) => `${p.email},${p.password}`)];
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
    console.log('Generated passwords written to:', outPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
