import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp as initializeClientApp } from 'firebase/app';
import { 
  getFirestore as getClientFirestore, 
  collection as clientCollection, 
  getDocs as clientGetDocs, 
  limit as clientLimit, 
  query as clientQuery,
  doc as clientDoc,
  addDoc as clientAddDoc,
  setDoc as clientSetDoc,
  updateDoc as clientUpdateDoc,
  deleteDoc as clientDeleteDoc,
  getDoc as clientGetDoc,
  serverTimestamp as clientServerTimestamp
} from 'firebase/firestore';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logs: string[] = [];
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => {
  const msg = `[LOG] ${args.join(' ')}`;
  logs.push(msg);
  fs.appendFileSync('server.log', msg + '\n');
  originalLog(...args);
};
console.error = (...args) => {
  const msg = `[ERROR] ${args.join(' ')}`;
  logs.push(msg);
  fs.appendFileSync('server.log', msg + '\n');
  originalError(...args);
};
console.warn = (...args) => {
  const msg = `[WARN] ${args.join(' ')}`;
  logs.push(msg);
  fs.appendFileSync('server.log', msg + '\n');
  originalWarn(...args);
};

async function startServer() {
  console.log('Starting server...');
  const app = express();
  app.use(express.json());

  app.get('/api/finance-based-saving/debug/logs', (req, res) => {
    res.send(logs.join('\n'));
  });

  const PORT = 3000;

  let db: any = null;
  let dbInitError: string | null = null;
  let isClientDb = false;

  // Initialize Database in background to prevent server hang
  const initializeDatabase = async () => {
    try {
      // Load Firebase Config
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (!fs.existsSync(configPath)) {
        throw new Error(`firebase-applet-config.json not found at ${configPath}`);
      }
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log('Firebase config loaded for project:', firebaseConfig.projectId);

      const dbId = firebaseConfig.firestoreDatabaseId;
      
      // We'll use the Client SDK as the primary database because Admin SDK is having permission issues
      console.log(`Initializing Firestore via Client SDK. Project: ${firebaseConfig.projectId}, Database: ${dbId || '(default)'}`);
      
      try {
        const clientApp = initializeClientApp(firebaseConfig);
        const clientDb = getClientFirestore(clientApp, dbId === '(default)' ? undefined : dbId);
        
        // Test connection
        console.log('Testing Firestore connection...');
        const q = clientQuery(clientCollection(clientDb, 'members'), clientLimit(1));
        const clientSnap = await clientGetDocs(q);
        console.log(`Firestore initialized via Client SDK. Empty: ${clientSnap.empty}`);
        
        db = clientDb;
        isClientDb = true;
      } catch (clientErr: any) {
        console.error(`Firestore initialization failed via Client SDK:`, clientErr.message);
        if (clientErr.message.includes('Cloud Firestore API has not been used')) {
          dbInitError = `Cloud Firestore API is disabled in project ${firebaseConfig.projectId}. Please enable it in the Google Cloud Console.`;
        } else {
          dbInitError = `Firestore connection failed: ${clientErr.message}`;
        }
      }
    } catch (error: any) {
      console.error('Failed to load Firebase config or init Firestore:', error);
      dbInitError = `Init failed: ${error.message}`;
    }
  };

  // Start initialization but don't await it here
  initializeDatabase();

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    let configProjectId = 'unknown';
    try {
      configProjectId = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8')).projectId;
    } catch (e) {}
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      dbInitialized: !!db,
      dbInitError,
      isClientDb,
      configProjectId
    });
  });

  // Middleware to check admin password
  const checkAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    console.log('Auth check:', { 
      received: authHeader, 
      expected: 'Basic FinSaver_Pro:wealth@X26',
      match: authHeader === 'Basic FinSaver_Pro:wealth@X26'
    });
    if (authHeader === 'Basic FinSaver_Pro:wealth@X26') {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };

  app.get('/api/finance-based-saving/debug/members', checkAdmin, async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized' });
    try {
      const snapshot = await clientGetDocs(clientCollection(db, 'members'));
      const docs = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/finance-based-saving/members', checkAdmin, async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized' });
    try {
      const docRef = await clientAddDoc(clientCollection(db, 'members'), {
        ...req.body,
        createdAt: clientServerTimestamp()
      });
      res.json({ id: docRef.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/finance-based-saving/members/:id', checkAdmin, async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized' });
    try {
      await clientUpdateDoc(clientDoc(db, 'members', req.params.id), req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/finance-based-saving/members/:id', checkAdmin, async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized' });
    try {
      await clientDeleteDoc(clientDoc(db, 'members', req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/finance-based-saving/transactions', checkAdmin, async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized' });
    try {
      const docRef = await clientAddDoc(clientCollection(db, 'transactions'), {
        ...req.body,
        createdAt: clientServerTimestamp()
      });
      res.json({ id: docRef.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/finance-based-saving/deposit', checkAdmin, async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized' });
    const { memberId, amount, date, month, newTotal } = req.body;
    console.log('Processing deposit:', { memberId, amount, date, month, newTotal });
    
    try {
      // Diagnostic: Check if member exists
      const memberRef = clientDoc(db, 'members', memberId);
      console.log(`Fetching member doc: ${memberId}`);
      const memberDoc = await clientGetDoc(memberRef);
      if (!memberDoc.exists()) {
        console.error(`Member with ID ${memberId} not found in database`);
        return res.status(404).json({ error: `Member not found: ${memberId}` });
      }
      console.log(`Member found: ${memberDoc.data()?.name}`);

      // 1. Add Transaction
      console.log('Adding transaction...');
      await clientAddDoc(clientCollection(db, 'transactions'), { 
        memberId, 
        amount: Number(amount), 
        date, 
        month,
        createdAt: clientServerTimestamp()
      });
      
      // 2. Update Member
      console.log('Updating member...');
      await clientSetDoc(memberRef, { 
        totalDeposited: Number(newTotal),
        lastPaymentDate: date
      }, { merge: true });
      
      console.log('Deposit processed successfully');
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error processing deposit:', error);
      const message = error.message || 'Unknown error occurred';
      res.status(500).json({ error: `Server Error: ${message}` });
    }
  });

  app.post('/api/finance-based-saving/settings', checkAdmin, async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized' });
    try {
      const settingsColl = clientCollection(db, 'settings');
      const q = clientQuery(settingsColl, clientLimit(1));
      const snapshot = await clientGetDocs(q);
      if (snapshot.empty) {
        await clientAddDoc(settingsColl, req.body);
      } else {
        await clientUpdateDoc(clientDoc(db, 'settings', snapshot.docs[0].id), req.body);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    console.log('Initializing Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware initialized');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
});
