import Database from 'better-sqlite3';
import path from 'path';

// Create 3 separate databases as requested
export const userDb = new Database('user.db');
export const companyDb = new Database('company.db');
export const chemicalDb = new Database('chemical.db');

export function initDbs() {
  // Company Table
  companyDb.exec(`
    CREATE TABLE IF NOT EXISTS company (
      company_ID TEXT PRIMARY KEY,
      company_name TEXT,
      company_user_name TEXT,
      company_password TEXT,
      developer_code TEXT
    )
  `);

  // User Table
  userDb.exec(`
    CREATE TABLE IF NOT EXISTS user (
      user_ID TEXT PRIMARY KEY,
      company_ID TEXT,
      user_full_name TEXT,
      user_level INTEGER,
      user_name TEXT,
      user_password TEXT,
      user_mail TEXT
    )
  `);

  // Chemical Table
  chemicalDb.exec(`
    CREATE TABLE IF NOT EXISTS chemical (
      chemical_CAS TEXT PRIMARY KEY,
      chemical_name TEXT,
      chemical_level INTEGER,
      life_storage TEXT,
      condition TEXT,
      stored_for TEXT,
      extra_user TEXT,
      extra_info TEXT,
      temperature TEXT,
      humidity TEXT,
      light_exposure TEXT,
      flammable TEXT,
      explosive TEXT,
      boiling_point TEXT,
      freezing_point TEXT,
      ignition_point TEXT,
      safe TEXT
    )
  `);

  // Seed initial data if empty (based on the screenshot)
  const companyCount = companyDb.prepare('SELECT count(*) as count FROM company').get() as any;
  if (companyCount.count === 0) {
    const insertCompany = companyDb.prepare('INSERT INTO company (company_ID, company_name, developer_code) VALUES (?, ?, ?)');
    for (let i = 1; i <= 7; i++) {
      insertCompany.run(i.toString(), `COMP0${i}`, i.toString());
    }
  }

  const userCount = userDb.prepare('SELECT count(*) as count FROM user').get() as any;
  if (userCount.count === 0) {
    const insertUser = userDb.prepare('INSERT INTO user (user_ID) VALUES (?)');
    for (let i = 1; i <= 7; i++) {
      insertUser.run(i.toString());
    }
  }
}
