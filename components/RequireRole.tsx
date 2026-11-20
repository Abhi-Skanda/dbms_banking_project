'use client';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import type { Role } from '@/lib/types';
import { Card } from './ui';

/** Renders children only for the listed roles (the API enforces the same rules). */
export default function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (!roles.includes(user.role)) {
    return (
      <Card className="mx-auto mt-10 max-w-md text-center">
        <h2 className="text-lg font-semibold text-slate-900">Access denied</h2>
        <p className="mt-2 text-sm text-slate-500">Your role ({user.role.toLowerCase()}) doesn’t have access to this page.</p>
      </Card>
    );
  }
  return <>{children}</>;
}
