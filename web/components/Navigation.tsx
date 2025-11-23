'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Menu, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';

export function Navigation() {
  const { user, logout, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav className="bg-gray-900 text-white shadow-lg">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="text-xl font-bold text-brand">
            MHN
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/dashboard" className="hover:text-brand transition">
              Dashboard
            </Link>
            <Link href="/attacks" className="hover:text-brand transition">
              Attacks
            </Link>
            <Link href="/sensors" className="hover:text-brand transition">
              Sensors
            </Link>
            <Link href="/rules" className="hover:text-brand transition">
              Rules
            </Link>
            <Link href="/integrations" className="hover:text-brand transition">
              Integrations
            </Link>
            <Link href="/analytics" className="hover:text-brand transition">
              Analytics
            </Link>
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center gap-4">
            <span className="text-sm text-gray-300">{user?.email}</span>
            <Link href="/settings" className="p-2 hover:bg-gray-800 rounded">
              <Settings size={20} />
            </Link>
            <button
              onClick={logout}
              className="p-2 hover:bg-gray-800 rounded"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu size={24} />
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link href="/dashboard" className="block p-2 hover:bg-gray-800 rounded">
              Dashboard
            </Link>
            <Link href="/attacks" className="block p-2 hover:bg-gray-800 rounded">
              Attacks
            </Link>
            <Link href="/sensors" className="block p-2 hover:bg-gray-800 rounded">
              Sensors
            </Link>
            <Link href="/rules" className="block p-2 hover:bg-gray-800 rounded">
              Rules
            </Link>
            <Link href="/integrations" className="block p-2 hover:bg-gray-800 rounded">
              Integrations
            </Link>
            <Link href="/analytics" className="block p-2 hover:bg-gray-800 rounded">
              Analytics
            </Link>
            <button
              onClick={logout}
              className="w-full text-left p-2 hover:bg-gray-800 rounded flex items-center gap-2"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
