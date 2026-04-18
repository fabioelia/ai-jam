import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store.js';
import { apiFetch } from '../api/client.js';
import { ButtonLoader } from '../components/common/Skeleton.js';
import type { AuthResponse } from '@ai-jam/shared';

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Focus first input when form type changes
  useEffect(() => {
    if (isRegister && nameInputRef.current) {
      nameInputRef.current.focus();
    } else if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [isRegister]);

  function validateForm(): boolean {
    const errors: FormErrors = {};

    if (isRegister) {
      if (!name.trim()) {
        errors.name = 'Name is required';
      } else if (name.trim().length < 2) {
        errors.name = 'Name must be at least 2 characters';
      }
    }

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateForm();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFormErrors({});
    setTouched({ name: true, email: true, password: true });

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const body = isRegister ? { email, name, password } : { email, password };
      const data = await apiFetch<AuthResponse>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setAuth(data.user, data.tokens.accessToken, data.tokens.refreshToken);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      // Focus the first field with an error
      if (emailInputRef.current && !email) {
        emailInputRef.current.focus();
      } else if (passwordInputRef.current && !password) {
        passwordInputRef.current.focus();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-md shadow-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">AI Jam</h1>
          <p className="text-gray-400">
            {isRegister ? 'Create your account' : 'Sign in to your account'}
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-4 bg-red-900/20 border border-red-800 rounded-lg p-3 flex items-start gap-2 animate-shake animate-in fade-in duration-200"
          >
            <span className="text-red-400 text-lg shrink-0" aria-hidden="true">⚠</span>
            <p className="text-red-400 text-sm flex-1">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {isRegister && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1.5">
                Name <span className="text-red-400" aria-hidden="true">*</span>
              </label>
              <input
                ref={nameInputRef}
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => handleBlur('name')}
                aria-invalid={touched.name && !!formErrors.name}
                aria-describedby={touched.name && formErrors.name ? 'name-error' : undefined}
                className={`w-full bg-gray-800 border rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                  touched.name && formErrors.name
                    ? 'border-red-700 focus:ring-red-500'
                    : 'border-gray-700 focus:border-indigo-500/50'
                }`}
                placeholder="Your full name"
                autoComplete="name"
                required
              />
              {touched.name && formErrors.name && (
                <p id="name-error" className="text-red-400 text-xs mt-1.5 animate-in fade-in duration-200" role="alert">
                  {formErrors.name}
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
              Email <span className="text-red-400" aria-hidden="true">*</span>
            </label>
            <input
              ref={emailInputRef}
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => handleBlur('email')}
              aria-invalid={touched.email && !!formErrors.email}
              aria-describedby={touched.email && formErrors.email ? 'email-error' : undefined}
              className={`w-full bg-gray-800 border rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                touched.email && formErrors.email
                  ? 'border-red-700 focus:ring-red-500'
                  : 'border-gray-700 focus:border-indigo-500/50'
              }`}
              placeholder="you@example.com"
              autoComplete={isRegister ? 'email' : 'username'}
              required
            />
            {touched.email && formErrors.email && (
              <p id="email-error" className="text-red-400 text-xs mt-1.5 animate-in fade-in duration-200" role="alert">
                {formErrors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
              Password <span className="text-red-400" aria-hidden="true">*</span>
            </label>
            <input
              ref={passwordInputRef}
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => handleBlur('password')}
              aria-invalid={touched.password && !!formErrors.password}
              aria-describedby={
                touched.password && formErrors.password
                  ? 'password-error'
                  : 'password-hint'
              }
              className={`w-full bg-gray-800 border rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                touched.password && formErrors.password
                  ? 'border-red-700 focus:ring-red-500'
                  : 'border-gray-700 focus:border-indigo-500/50'
              }`}
              placeholder="••••••••"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
              minLength={6}
            />
            {touched.password && formErrors.password ? (
              <p id="password-error" className="text-red-400 text-xs mt-1.5 animate-in fade-in duration-200" role="alert">
                {formErrors.password}
              </p>
            ) : (
              <p id="password-hint" className="text-gray-500 text-xs mt-1.5">
                Must be at least 6 characters
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 focus:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 text-white font-medium rounded-lg py-2.5 px-4 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <ButtonLoader />
                {isRegister ? 'Creating account...' : 'Signing in...'}
              </>
            ) : (
              isRegister ? 'Create Account' : 'Sign In'
            )}
          </button>
        </form>

        <p className="text-gray-500 text-sm mt-6 text-center">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
              setFormErrors({});
              setTouched({});
            }}
            className="text-indigo-400 hover:text-indigo-300 focus:outline-none focus:underline focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded px-1 py-0.5 transition-colors"
          >
            {isRegister ? 'Sign in' : 'Register'}
          </button>
        </p>
      </div>
    </div>
  );
}
