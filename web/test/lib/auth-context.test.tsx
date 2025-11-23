import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/lib/auth-context';

/**
 * Component Tests: AuthContext
 * Tests authentication state management and context API
 */

describe('AuthContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('AuthProvider', () => {
    it('should provide default auth state', () => {
      const TestComponent = () => {
        const { isAuthenticated, user, loading } = useAuth();
        return (
          <div>
            <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
            <div data-testid="authenticated">{isAuthenticated ? 'true' : 'false'}</div>
            <div data-testid="user">{user?.email || 'no-user'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });

    it('should load user from localStorage on mount', async () => {
      const testUser = { id: 1, email: 'test@example.com', name: 'Test User' };
      localStorage.setItem('user', JSON.stringify(testUser));
      localStorage.setItem('accessToken', 'test-token');

      const TestComponent = () => {
        const { isAuthenticated, user } = useAuth();
        return (
          <div>
            <div data-testid="authenticated">{isAuthenticated ? 'true' : 'false'}</div>
            <div data-testid="user">{user?.email || 'no-user'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      });
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      const TestComponent = () => {
        useAuth(); // This should throw
        return <div>Test</div>;
      };

      // Suppress console.error for this test
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow();

      spy.mockRestore();
    });

    it('should provide login function', async () => {
      const TestComponent = () => {
        const { login, isAuthenticated } = useAuth();
        return (
          <div>
            <button onClick={() => login('test@example.com', 'password')}>Login</button>
            <div data-testid="authenticated">{isAuthenticated ? 'true' : 'false'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const loginButton = screen.getByRole('button', { name: 'Login' });
      expect(loginButton).toBeInTheDocument();
    });

    it('should provide logout function', async () => {
      const testUser = { id: 1, email: 'test@example.com', name: 'Test User' };
      localStorage.setItem('user', JSON.stringify(testUser));
      localStorage.setItem('accessToken', 'test-token');

      const TestComponent = () => {
        const { logout, isAuthenticated, user } = useAuth();
        return (
          <div>
            <button onClick={() => logout()}>Logout</button>
            <div data-testid="authenticated">{isAuthenticated ? 'true' : 'false'}</div>
            <div data-testid="user">{user?.email || 'no-user'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      });

      const logoutButton = screen.getByRole('button', { name: 'Logout' });
      expect(logoutButton).toBeInTheDocument();
    });

    it('should provide error state', async () => {
      const TestComponent = () => {
        const { error } = useAuth();
        return <div data-testid="error">{error || 'no-error'}</div>;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    });
  });
});
