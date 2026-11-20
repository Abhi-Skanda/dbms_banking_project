'use client';
import CustomerHome from '@/components/CustomerHome';
import StaffDashboard from '@/components/StaffDashboard';
import { useAuth } from '@/lib/auth-context';

// Same URL, different home screen depending on who signed in
export default function HomePage() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'CUSTOMER' ? <CustomerHome /> : <StaffDashboard />;
}
