import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';

export const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: implement actual auth
    if (email === 'admin@univoinfotech.com' && password === 'admin') {
      navigate(ROUTES.DASHBOARD);
    } else {
      alert('Invalid credentials. (Hint: admin@univoinfotech.com / admin)');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-green">
            Univo Infotech
          </h1>
          <p className="text-gray-500 mt-2">Sign in to your account</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none transition"
              placeholder="admin@univoinfotech.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none transition"
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-gradient-to-r from-brand-blue to-brand-green text-white py-2 rounded-lg hover:opacity-90 transition font-medium"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};
