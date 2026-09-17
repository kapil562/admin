import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import logo from '@/assets/logo.jpg';

export const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTimeout(() => {
      if (email === 'admin@univoinfotech.com' && password === 'admin123') {
        navigate(ROUTES.DASHBOARD);
      } else {
        setError('Invalid email or password. Please try again.');
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0A192F 0%, #0047B3 60%, #005CE6 100%)',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: '420px', padding: '0 16px' }}>
        {/* Card */}
        <div style={{
          background: 'white',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
        }}>
          {/* Top banner with logo */}
          <div style={{
            background: 'linear-gradient(135deg, #0A192F 0%, #005CE6 100%)',
            padding: '36px 32px 28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            {/* Logo container */}
            <div style={{
              width: '80px',
              height: '80px',
              background: 'white',
              borderRadius: '20px',
              padding: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <img
                src={logo}
                alt="Univo Infotech Logo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
            <h1 style={{
              color: 'white',
              fontSize: '22px',
              fontWeight: 800,
              margin: 0,
              letterSpacing: '-0.3px',
            }}>
              Univo Infotech
            </h1>
            <p style={{
              color: 'rgba(147, 197, 253, 0.9)',
              fontSize: '13px',
              marginTop: '6px',
              fontWeight: 400,
            }}>
              Admin Management Portal
            </p>
          </div>

          {/* Form area */}
          <div style={{ padding: '32px' }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#0A192F',
              margin: '0 0 8px 0',
            }}>
              Welcome back 👋
            </h2>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 24px 0' }}>
              Sign in to access your dashboard
            </p>

            {/* Error message */}
            {error && (
              <div style={{
                background: '#FEE2E2',
                border: '1px solid #FECACA',
                color: '#B91C1C',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '13px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{ fontSize: '16px' }}>⚠️</span>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin}>
              {/* Email */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '6px',
                }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@univoinfotech.com"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: '12px',
                    fontSize: '14px',
                    outline: 'none',
                    color: '#111827',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#005CE6')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '6px',
                }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: '12px',
                    fontSize: '14px',
                    outline: 'none',
                    color: '#111827',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#005CE6')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '13px',
                  background: loading
                    ? '#9CA3AF'
                    : 'linear-gradient(90deg, #005CE6, #00C853)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.2s',
                  fontFamily: 'inherit',
                  letterSpacing: '0.2px',
                }}
              >
                {loading ? 'Signing in...' : 'Sign In →'}
              </button>
            </form>

            <p style={{
              textAlign: 'center',
              color: '#9CA3AF',
              fontSize: '12px',
              marginTop: '24px',
            }}>
              🔒 Access restricted to authorized personnel only
            </p>
          </div>
        </div>

        {/* Bottom label */}
        <p style={{
          textAlign: 'center',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '12px',
          marginTop: '20px',
        }}>
          © 2026 Univo Infotech. All rights reserved.
        </p>
      </div>
    </div>
  );
};
