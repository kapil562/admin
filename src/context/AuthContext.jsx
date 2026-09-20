import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { univoAuth, libraryAuth, univoDb } from '../firebase/config';


const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const LOCAL_STORAGE_KEY = 'univo_admin_session';

const KNOWN_SUPER_ADMIN_EMAILS = [
  'admin@univoinfotech.com',
  'univoinfotech@gmail.com',
  'vinayadav.0808@gmail.com',
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check local session cache first
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      try {
        setUser(JSON.parse(cached));
      } catch (e) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }

    // 2. Firebase Auth listener (Primary Univo Auth)
    const unsubUnivo = onAuthStateChanged(univoAuth, (fbUser) => {
      if (fbUser) {
        const adminData = {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || 'Administrator',
          role: 'super_admin',
        };
        setUser(adminData);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(adminData));
      }
      setLoading(false);
    });

    // 3. Firebase Auth listener (Library Auth)
    const unsubLibrary = onAuthStateChanged(libraryAuth, (fbUser) => {
      if (fbUser) {
        const adminData = {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || 'Administrator',
          role: 'super_admin',
        };
        setUser(adminData);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(adminData));
      }
      setLoading(false);
    });

    return () => {
      unsubUnivo();
      unsubLibrary();
    };
  }, []);

  const login = async (email, password) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      throw new Error('Please enter both Email and Password.');
    }

    // 1. Try Univo Infotech Firebase Auth
    try {
      const userCredential = await signInWithEmailAndPassword(univoAuth, cleanEmail, cleanPassword);
      const adminData = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName || 'Administrator',
        role: 'super_admin',
      };
      setUser(adminData);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(adminData));
      return adminData;
    } catch (univoErr) {
      console.warn('Univo Auth check returned:', univoErr.code);
    }

    // 2. Try Library Firebase Auth
    try {
      const libCredential = await signInWithEmailAndPassword(libraryAuth, cleanEmail, cleanPassword);
      const adminData = {
        uid: libCredential.user.uid,
        email: libCredential.user.email,
        displayName: libCredential.user.displayName || 'Administrator',
        role: 'super_admin',
      };
      setUser(adminData);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(adminData));
      return adminData;
    } catch (libErr) {
      console.warn('Library Auth check returned:', libErr.code);
    }

    // 3. Try Staff Users in Database
    try {
      const snap = await getDocs(collection(univoDb, 'staff_users'));
      const staffMember = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .find((s) => (s.email || '').toLowerCase() === cleanEmail || (s.name || '').toLowerCase() === cleanEmail);

      if (staffMember) {
        if (staffMember.status === 'inactive') {
          throw new Error('This staff account has been deactivated. Please contact Administrator.');
        }
        if (String(staffMember.password || '').trim() !== cleanPassword) {
          throw new Error('Incorrect staff password.');
        }

        const staffSession = {
          uid: staffMember.id,
          id: staffMember.id,
          email: staffMember.email,
          displayName: staffMember.name || 'Staff Member',
          name: staffMember.name || 'Staff Member',
          role: staffMember.role || 'marketing',
          roleLabel: staffMember.roleLabel || 'Staff Member',
          permissions: staffMember.permissions || {},
          phone: staffMember.phone || '',
          compensation: staffMember.compensation || {},
        };
        setUser(staffSession);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(staffSession));
        return staffSession;
      }
    } catch (sErr) {
      if (sErr.message.includes('deactivated') || sErr.message.includes('Incorrect staff password')) {
        throw sErr;
      }
    }

    // 4. Master Administrator Bypass Check
    const isMasterAdminEmail =
      cleanEmail === 'admin' ||
      cleanEmail.startsWith('admin') ||
      KNOWN_SUPER_ADMIN_EMAILS.includes(cleanEmail) ||
      cleanEmail.startsWith('admin@') ||
      cleanEmail.includes('univo');

    const isMasterPassword =
      cleanPassword === 'admin123' ||
      cleanPassword === 'admin';

    if (isMasterAdminEmail || isMasterPassword) {
      const masterAdmin = {
        uid: 'master_admin_session',
        email: cleanEmail.includes('@') ? cleanEmail : 'admin@univoinfotech.com',
        displayName: cleanEmail.includes('@') ? cleanEmail.split('@')[0].toUpperCase() : 'Administrator',
        role: 'super_admin',
      };
      setUser(masterAdmin);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(masterAdmin));
      return masterAdmin;
    }

    throw new Error(
      'Login failed: User ID ya Password match nahi hua (agar aapne Staff ID delete ki thi toh wo remove ho chuki hai). Kripya Admin login use karein ya Quick Admin Access click karein.'
    );
  };

  const loginAsMasterAdmin = async () => {
    const masterAdmin = {
      uid: 'master_admin_session',
      email: 'admin@univoinfotech.com',
      displayName: 'Super Administrator',
      role: 'super_admin',
    };
    setUser(masterAdmin);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(masterAdmin));
    return masterAdmin;
  };

  const hasPermission = (moduleName, action = 'view') => {
    if (!user) return false;
    if (!user.role || user.role === 'super_admin') return true;

    const modulePerms = user.permissions?.[moduleName];
    if (modulePerms && modulePerms[action] !== undefined) {
      return Boolean(modulePerms[action]);
    }
    return false;
  };

  const logout = async () => {
    try {
      await signOut(univoAuth);
    } catch (e) {}
    try {
      await signOut(libraryAuth);
    } catch (e) {}
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    loginAsMasterAdmin,
    logout,
    hasPermission,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


