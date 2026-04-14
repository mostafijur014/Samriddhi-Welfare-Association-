import { initializeApp } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDocFromServer, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore - use named database if provided, otherwise default
export const db = (firebaseConfig as any).firestoreDatabaseId 
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

async function testConnection() {
  try {
    // Try to get a document from an allowed collection (settings) to test connectivity
    // Even if it doesn't exist, the permission check should pass
    await getDocFromServer(doc(db, 'settings', 'connection_test'));
    console.log("Firestore connection successful.");
  } catch (error: any) {
    console.error("Firestore Connection Test Error:", error);
    if(error?.message?.includes('insufficient permissions')) {
      console.warn("Connection test failed with permission error. This is expected if the user is not logged in and the collection is private.");
    } else if(error?.message?.includes('the client is offline') || error?.code === 'unavailable') {
      console.error("Please check your Firebase configuration. Ensure the Project ID is correct and Firestore is enabled.");
    }
  }
}
testConnection();

export const logout = () => signOut(auth);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
