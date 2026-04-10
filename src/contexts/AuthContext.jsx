import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState(null);
  const [notificationRefreshKey, setNotificationRefreshKey] = useState(0); // <-- BARU

  const mountedRef = useRef(true);
  const profilePromiseRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    const safeSet = (fn) => mountedRef.current && fn();

    const applySession = async (nextSession) => {
      safeSet(() => setSession(nextSession));
      if (!nextSession?.user?.id) safeSet(() => setUserProfile(null));
    };

    const initialize = async () => {
      setAuthLoading(true);
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[Auth] getSession error:', error);
          safeSet(() => setSession(null));
          safeSet(() => setUserProfile(null));
        } else {
          await applySession(data?.session ?? null);
        }
      } catch (e) {
        console.error('[Auth] init getSession failed:', e);
        safeSet(() => setSession(null));
        safeSet(() => setUserProfile(null));
      } finally {
        if (mountedRef.current) setAuthLoading(false);
      }
    };

    initialize();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        await applySession(newSession);
      }
    );

    return () => {
      mountedRef.current = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  // Fungsi fetch profile dengan join ke companies untuk mengambil status langganan
  const fetchProfile = async (userId) => {
    // Menambahkan subscription_end_date dan is_manually_locked dari tabel companies
    const { data, error } = await supabase
      .from('profiles')
      .select(
        `id, role, company_id, full_name, 
                 companies(name, logo_url, subscription_end_date, is_manually_locked, fonnte_token)`
      )
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  };

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    if (profilePromiseRef.current) return;

    let cancelled = false;
    profilePromiseRef.current = (async () => {
      try {
        setProfileLoading(true);
        const data = await fetchProfile(userId);

        if (!cancelled) {
          setUserProfile(data);
          setActiveCompanyId(data.company_id);
        }
      } catch (err) {
        console.warn(
          '[Auth] profile load failed, will retry on next auth change/focus:',
          err
        );
      } finally {
        profilePromiseRef.current = null;
        if (!cancelled) setProfileLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!session?.user?.id) return;
      if (userProfile || profilePromiseRef.current) return;

      try {
        const data = await fetchProfile(session.user.id);
        setUserProfile(data);
        setActiveCompanyId(data.company_id);
      } catch (error) {
        console.warn(
          '[Auth] profile reload failed on visibility change:',
          error
        );
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [session?.user?.id, userProfile]);

  const handleSetActiveCompany = (companyId) => {
    if (userProfile?.role === 'super_admin') {
      setActiveCompanyId(companyId);
    }
  };
  
  // FUNGSI BARU: Memicu refresh notifikasi
  const triggerNotificationRefresh = () => {
    setNotificationRefreshKey(prev => prev + 1);
  };
  // END FUNGSI BARU

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (
          error.code === 'session_not_found' ||
          msg.includes('auth session missing') ||
          error.status === 403
        ) {
          console.info(
            '[Auth] signOut: session already missing or revoked (benign):',
            error
          );
        } else {
          console.warn('[Auth] signOut error (will rethrow):', error);
          throw error;
        }
      }
    } catch (err) {
      const m = (err && (err.message || String(err))).toLowerCase();
      if (
        m.includes('auth session missing') ||
        m.includes('session_not_found') ||
        m.includes('403')
      ) {
        console.info('[Auth] signOut: treated as benign (caught):', err);
      } else {
        console.error('[Auth] Unexpected signOut error:', err);
        throw err;
      }
    } finally {
      try {
        setSession(null);
        setUserProfile(null);
        setActiveCompanyId(null);
        profilePromiseRef.current = null;

        try {
          const keys = Object.keys(localStorage || {});
          for (const k of keys) {
            if (!k) continue;
            const kl = k.toLowerCase();
            if (
              kl.includes('supabase') ||
              kl.includes('sb:') ||
              kl.includes('sb-') ||
              kl.includes('gotrue')
            ) {
              localStorage.removeItem(k);
            }
          }
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // ignore
      }
    }
  };

  const contextValue = useMemo(() => {
    // Mengambil status langganan dari objek companies
    const companySubscription = userProfile?.companies;

    // --- LOGIKA KUNCI AKSES BARU (PERUSAHAAN) ---
    let isExpired = false;
    // Pengecekan hanya jika userProfile ada dan bukan SuperAdmin
    if (
      userProfile &&
      userProfile.role !== 'super_admin' &&
      companySubscription?.subscription_end_date
    ) {
      const expiryDate = new Date(companySubscription.subscription_end_date);
      isExpired = new Date() > expiryDate;
    }

    // Akses DITOLAK jika: (1) Dikunci manual di level perusahaan ATAU (2) Langganan perusahaan kedaluwarsa
    const isAccessDenied =
      companySubscription?.is_manually_locked === true || isExpired;
    // --- AKHIR LOGIKA KUNCI AKSES ---

    return {
      session,
      userProfile,
      loading: authLoading || profileLoading,
      authLoading,
      profileLoading,
      isAuthenticated: !!session,
      userId: session?.user?.id ?? null,
      userRole: userProfile?.role ?? null,
      companyId: activeCompanyId ?? userProfile?.company_id ?? null,
      companyName: userProfile?.companies?.name ?? null,
      companyLogo: userProfile?.companies?.logo_url ?? null,
      // Properti BARU untuk pengecekan akses
      isAccessDenied,
      isSubscriptionExpired: isExpired,
      isManuallyLocked: companySubscription?.is_manually_locked ?? false,
      subscriptionEndDate: companySubscription?.subscription_end_date ?? null,

      // PROPERTI BARU UNTUK REFRESH
      notificationRefreshKey,
      triggerNotificationRefresh,
      // END PROPERTI BARU

      refreshProfile: async () => {
        if (!session?.user?.id) return null;
        const data = await fetchProfile(session.user.id);
        if (data) {
          setUserProfile(data);
          setActiveCompanyId(data.company_id);
        }
        return data ?? null;
      },
      setActiveCompany: handleSetActiveCompany,
      signOut,
    };
  }, [
    session,
    userProfile,
    authLoading,
    profileLoading,
    activeCompanyId,
    notificationRefreshKey, // <-- TAMBAH DEPENDENCY
  ]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;