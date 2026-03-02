import express from 'express';
import { createServer as createViteServer } from 'vite';
import { userDb, companyDb, chemicalDb, initDbs } from './src/db.ts';
import dotenv from 'dotenv';

dotenv.config();
initDbs();

const app = express();
app.use(express.json());

// --- API Routes ---

// User Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = userDb.prepare('SELECT * FROM user WHERE user_name = ? AND user_password = ?').get(username, password) as any;
  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: 'User name or password wrong. Try again.' });
  }
});

// User Sign In (Registration)
app.post('/api/user/check-company', (req, res) => {
  const { companyId } = req.body;
  const company = companyDb.prepare('SELECT * FROM company WHERE company_ID = ?').get(companyId) as any;
  if (company) {
    res.json({ success: true, companyName: company.company_name });
  } else {
    res.status(404).json({ success: false, message: 'Company not found. Try again.' });
  }
});

app.post('/api/user/check-user', (req, res) => {
  const { userId } = req.body;
  const user = userDb.prepare('SELECT * FROM user WHERE user_ID = ?').get(userId) as any;
  if (user) {
    res.json({ success: true, userFullName: user.user_full_name });
  } else {
    res.status(404).json({ success: false, message: 'User not found. Try again.' });
  }
});

app.post('/api/user/register', (req, res) => {
  const { userId, companyId, username, password, email } = req.body;
  
  if (!userId || !companyId || !username || !password || !email) {
    return res.status(400).json({ success: false, message: 'Fill in all fields and try again.' });
  }

  if (!email.includes('@') || !email.endsWith('.com')) {
    return res.status(400).json({ success: false, message: 'Invalid email format.' });
  }

  try {
    userDb.prepare('UPDATE user SET company_ID = ?, user_name = ?, user_password = ?, user_mail = ? WHERE user_ID = ?')
      .run(companyId, username, password, email, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error saving user.' });
  }
});

// Company Login
app.post('/api/company/login', (req, res) => {
  const { username, password } = req.body;
  const company = companyDb.prepare('SELECT * FROM company WHERE company_user_name = ? AND company_password = ?').get(username, password) as any;
  if (company) {
    res.json({ success: true, company });
  } else {
    res.status(401).json({ success: false, message: 'User not found or wrong password. Try again or contact developer' });
  }
});

// Company Sign In (Registration)
app.post('/api/company/register', (req, res) => {
  const { companyId, username, password, devCode } = req.body;
  
  if (!companyId || !username || !password || !devCode) {
    return res.status(400).json({ success: false, message: 'All the spaces have to be filled.' });
  }

  const existing = companyDb.prepare('SELECT * FROM company WHERE company_user_name = ?').get(username);
  if (existing) {
    return res.status(400).json({ success: false, message: 'This User Name is already in use.' });
  }

  const company = companyDb.prepare('SELECT * FROM company WHERE company_ID = ?').get(companyId) as any;
  if (!company) {
    return res.status(404).json({ success: false, message: 'Company ID not found, try again.' });
  }

  if (company.developer_code !== devCode) {
    return res.status(400).json({ success: false, message: 'Developer Authorization Code dont match with company, try again or contact developer' });
  }

  try {
    companyDb.prepare('UPDATE company SET company_user_name = ?, company_password = ? WHERE company_ID = ?')
      .run(username, password, companyId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error saving company.' });
  }
});

// Add User (Company Action)
app.get('/api/company/next-user-id', (req, res) => {
  try {
    let nextUser = userDb.prepare('SELECT user_ID FROM user WHERE user_full_name IS NULL OR user_full_name = "" ORDER BY CAST(user_ID AS INTEGER) ASC LIMIT 1').get() as any;
    
    if (!nextUser) {
      const maxIdRow = userDb.prepare('SELECT MAX(CAST(user_ID AS INTEGER)) as maxId FROM user').get() as any;
      const nextId = (maxIdRow?.maxId || 0) + 1;
      // Create the record so it's reserved
      userDb.prepare('INSERT INTO user (user_ID) VALUES (?)').run(nextId.toString());
      nextUser = { user_ID: nextId.toString() };
    }
    
    res.json({ userId: nextUser.user_ID });
  } catch (error) {
    console.error('Error in next-user-id:', error);
    res.status(500).json({ success: false, message: 'Error generating next user ID' });
  }
});

app.post('/api/company/add-user', (req, res) => {
  const { userId, fullName, level, companyId } = req.body;
  console.log('Adding user:', { userId, fullName, level, companyId });
  if (!userId || !fullName || !level) {
    return res.status(400).json({ success: false, message: 'Todos os espacos devem ser preenchidos' });
  }

  try {
    const existingId = userDb.prepare('SELECT * FROM user WHERE user_ID = ?').get(userId) as any;
    console.log('Existing user check:', existingId);
    
    if (existingId && existingId.user_full_name) {
      return res.status(400).json({ success: false, message: 'This User ID is already in use by another user.' });
    }

    const existingName = userDb.prepare('SELECT * FROM user WHERE user_full_name = ?').get(fullName);
    if (existingName) {
      return res.status(400).json({ success: false, message: 'Usuario ja registrado' });
    }

    if (existingId) {
      // Slot exists but is empty, update it
      console.log('Updating existing slot');
      userDb.prepare('UPDATE user SET user_full_name = ?, user_level = ?, company_ID = ? WHERE user_ID = ?')
        .run(fullName, level, companyId, userId);
    } else {
      // New ID, insert it
      console.log('Inserting new user');
      userDb.prepare('INSERT INTO user (user_ID, user_full_name, user_level, company_ID) VALUES (?, ?, ?, ?)')
        .run(userId, fullName, level, companyId);
    }
    res.json({ success: true, message: 'user added' });
  } catch (error) {
    console.error('Error in add-user:', error);
    res.status(500).json({ success: false, message: 'Error adding user.' });
  }
});

app.post('/api/chemical/save', (req, res) => {
  const { cas, name, oshaData } = req.body;
  try {
    chemicalDb.prepare(`
      INSERT OR REPLACE INTO chemical (
        chemical_CAS, chemical_name, chemical_level, temperature, humidity, light_exposure, 
        flammable, explosive, boiling_point, freezing_point, ignition_point, safe
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cas, name, oshaData.chemical_level, oshaData.temperature, oshaData.humidity, oshaData.light_exposure,
      oshaData.flammable, oshaData.explosive, oshaData.boiling_point, 
      oshaData.freezing_point, oshaData.ignition_point, oshaData.safe
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving chemical:', error);
    res.status(500).json({ success: false, message: 'Error saving chemical.' });
  }
});

// Chatbot logic for Page 07
app.post('/api/chatbot/query', async (req, res) => {
  const { query } = req.body;
  // Case-insensitive search for name and exact for CAS
  const chemical = chemicalDb.prepare('SELECT * FROM chemical WHERE chemical_CAS = ? OR LOWER(chemical_name) = LOWER(?)').get(query, query) as any;
  if (chemical) {
    res.json({ success: true, chemical });
  } else {
    res.status(404).json({ success: false, message: 'Chemical CAS or chemical ID, was not found in our company database.' });
  }
});

app.post('/api/chatbot/save-storage', (req, res) => {
  const { cas, lifeStorage, condition, storedFor, extraUser } = req.body;
  try {
    chemicalDb.prepare('UPDATE chemical SET life_storage = ?, condition = ?, stored_for = ?, extra_user = ? WHERE chemical_CAS = ?')
      .run(lifeStorage, condition, storedFor, extraUser, cas);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// OSHA Lookup Proxy
app.get('/api/osha/lookup/:cas', async (req, res) => {
  const { cas } = req.params;
  try {
    const oshaUrl = `https://www.osha.gov/chemicaldata/search?cas_number=${cas}`;
    const response = await fetch(oshaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: `OSHA returned status ${response.status}` });
    }

    const html = await response.text();
    res.json({ 
      success: true, 
      url: response.url,
      htmlSnippet: html.substring(0, 20000) 
    });
  } catch (error) {
    console.error('OSHA Lookup Error:', error);
    res.status(500).json({ success: false, message: 'Failed to reach OSHA database.' });
  }
});

// CAMEO Chemicals Lookup Proxy
app.get('/api/cameo/lookup/:cas', async (req, res) => {
  const { cas } = req.params;
  try {
    const cameoUrl = `https://cameochemicals.noaa.gov/search/simple?search_type=cas&cas_number=${encodeURIComponent(cas)}`;
    
    const response = await fetch(cameoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      },
      redirect: 'follow'
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: `CAMEO returned status ${response.status}` });
    }

    const html = await response.text();
    
    res.json({ 
      success: true, 
      url: response.url,
      htmlSnippet: html.substring(0, 30000) 
    });
  } catch (error) {
    console.error('CAMEO Lookup Error:', error);
    res.status(500).json({ success: false, message: 'Failed to reach CAMEO Chemicals database.' });
  }
});

// Inventory
app.get('/api/inventory', (req, res) => {
  const chemicals = chemicalDb.prepare('SELECT * FROM chemical').all();
  res.json({ chemicals });
});

// --- Vite Middleware ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
