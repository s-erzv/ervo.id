// src/contexts/SubscriptionContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext'; // Asumsi kamu punya ini

const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
  const { companyId } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSubscription() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const { data } = await supabase
          .from('companies')
          .select(`
            subscription_end_date,
            subscription_plans ( name, features, max_users )
          `)
          .eq('id', companyId)
          .single();

        setSubscription(data);
      } catch (error) {
        console.error('Error fetching subscription:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSubscription();
  }, [companyId]);

  // Evaluasi apakah plan belum expired
  const isActive = subscription && new Date(subscription.subscription_end_date) > new Date();

  // Helper murni untuk mengecek toggle
  const hasFeature = (featureName) => {
    if (!isActive || !subscription?.subscription_plans?.features) return false;
    // Jika features adalah array, kita anggap itu list feature yang aktif
    if (Array.isArray(subscription.subscription_plans.features)) {
      return subscription.subscription_plans.features.includes(featureName);
    }
    return subscription.subscription_plans.features.toggles?.[featureName] === true;
  };

  // Helper murni untuk mengecek kuota
  const getLimit = (limitName) => {
    if (!subscription?.subscription_plans) return 0;
    
    // Check top level column first (misal max_users)
    if (subscription.subscription_plans[limitName] !== undefined) {
      return subscription.subscription_plans[limitName];
    }

    if (!subscription.subscription_plans.features) return 0;
    return subscription.subscription_plans.features.limits?.[limitName] || 0;
  };

  return (
    <SubscriptionContext.Provider value={{ isActive, hasFeature, getLimit, loading }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);