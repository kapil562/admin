import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { collection, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { univoAuth, libraryAuth, univoDb } from '../firebase/config';
import { ROLE_PRESETS } from '../firebase/services/staffService';
import toast from 'react-hot-toast';

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
  const staffSnapshotUnsubRef = useRef(null);

  // 1. Initial Session Load & Firebase Auth Handlers
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

  // 2. Real-Time Staff User Listener: Sync role, permissions & status immediately
  useEffect(() => {
    if (staffSnapshotUnsubRef.current) {
      staffSnapshotUnsubRef.current();
      staffSnapshotUnsubRef.current = null;
    }

    const staffId = user?.id || user?.uid;
    if (!staffId || staffId === 'master_admin_session') {
      return;
    }

    try {
      const staffRef = doc(univoDb, 'staff_users', staffId);
      staffSnapshotUnsubRef.current = onSnapshot(
        staffRef,
        (snap) => {
          if (!snap.exists()) {
            return;
          }

          const liveData = snap.data();
          if (liveData.status === 'inactive') {
            toast.error('Your staff account has been deactivated. Logging out.');
            logout();
            return;
          }

          const isOwner = liveData.role === 'owner' || liveData.role === 'super_admin';
          const updatedSession = {
            uid: snap.id,
            id: snap.id,
            email: liveData.email,
            displayName: liveData.name || (isOwner ? '👑 Business Owner' : 'Staff Member'),
            name: liveData.name || 'Staff Member',
            role: isOwner ? 'super_admin' : (liveData.role || 'marketing'),
            originalRole: liveData.role,
            roleLabel: liveData.roleLabel || (isOwner ? '👑 Business Owner / Super Admin' : 'Staff Member'),
            permissions: liveData.permissions || (ROLE_PRESETS[liveData.role]?.permissions || {}),
            phone: liveData.phone || '',
            compensation: liveData.compensation || {},
            status: liveData.status || 'active',
          };

          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedSession));
          setUser(updatedSession);
        },
        (err) => {
          console.warn('Real-time staff sync listener error:', err);
        }
      );
    } catch (e) {
      console.warn('Failed to attach staff snapshot listener:', e);
    }

    return () => {
      if (staffSnapshotUnsubRef.current) {
        staffSnapshotUnsubRef.current();
        staffSnapshotUnsubRef.current = null;
      }
    };
  }, [user?.id]);

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

        const isOwner = staffMember.role === 'owner' || staffMember.role === 'super_admin';
        const staffSession = {
          uid: staffMember.id,
          id: staffMember.id,
          email: staffMember.email,
          displayName: staffMember.name || (isOwner ? '👑 Business Owner' : 'Staff Member'),
          name: staffMember.name || 'Staff Member',
          role: isOwner ? 'super_admin' : (staffMember.role || 'marketing'),
          originalRole: staffMember.role,
          roleLabel: staffMember.roleLabel || (isOwner ? '👑 Business Owner / Super Admin' : 'Staff Member'),
          permissions: staffMember.permissions || (ROLE_PRESETS[staffMember.role]?.permissions || {}),
          phone: staffMember.phone || '',
          compensation: staffMember.compensation || {},
          status: staffMember.status || 'active',
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
      'Login failed: User ID or Password does not match. Please verify your credentials or click Quick Admin Access.'
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

  const updateCurrentUser = (updates) => {
    setUser((prev) => {
      const merged = { ...prev, ...updates };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });
  };

  /**
   * Evaluates if the current user has permission for a specific module and action
   * (e.g. hasPermission('marketing', 'create'))
   */
  const hasPermission = (moduleName, action = 'view') => {
    if (!user) return false;
    // Super admin and Owners have unrestricted authority across all modules
    if (
      !user.role ||
      user.role === 'super_admin' ||
      user.role === 'owner' ||
      user.originalRole === 'owner'
    ) {
      return true;
    }

    // Check specific module permission on user profile
    const modulePerms = user.permissions?.[moduleName];
    if (modulePerms && modulePerms[action] !== undefined) {
      return Boolean(modulePerms[action]);
    }

    // Fallback to role presets if not explicitly configured in permissions object
    const effectiveRole = user.originalRole || user.role;
    const preset = ROLE_PRESETS[effectiveRole];
    if (preset?.permissions?.[moduleName]?.[action] !== undefined) {
      return Boolean(preset.permissions[moduleName][action]);
    }

    return false;
  };

  const logout = async () => {
    if (staffSnapshotUnsubRef.current) {
      staffSnapshotUnsubRef.current();
      staffSnapshotUnsubRef.current = null;
    }
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
    updateCurrentUser,
    hasPermission,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


