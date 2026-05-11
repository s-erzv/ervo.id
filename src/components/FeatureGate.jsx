// src/components/FeatureGate.jsx
import { useSubscription } from '../contexts/SubscriptionContext';

export default function FeatureGate({ feature, fallback = null, children }) {
  const { hasFeature, loading } = useSubscription();

  if (loading) return null; // Bisa diganti skeleton loader
  
  if (!hasFeature(feature)) {
    // Tampilkan tombol "Upgrade" / lock icon jika fallback disediakan
    return fallback; 
  }

  return children;
}