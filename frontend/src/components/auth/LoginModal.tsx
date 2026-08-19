import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { X, Lock, Mail, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { isLoginOpen, closeLoginModal, login } = useAuth();
  const { addToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoginOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      addToast('Please enter a valid email address.', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      await login(email, password);
      addToast(`Logged in successfully as ${email}`, 'success');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      addToast(`Login failed: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillAdmin = () => {
    setEmail('b.obaga@landscapealliance.org');
    setPassword('admin123');
  };

  const fillResearcher = () => {
    setEmail('researcher@agriscience.org');
    setPassword('researcher123');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-forest-900 border border-forest-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header background decoration */}
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                <Lock className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white font-sans">Researcher Access</h3>
                <p className="text-xs text-gray-400">Log in to unlock AI models & custom settings</p>
              </div>
            </div>
            <button
              onClick={closeLoginModal}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-forest-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Preset Buttons */}
          <div className="p-3 bg-forest-800/60 rounded-xl border border-forest-700/50 space-y-2">
            <div className="text-xs text-gray-400 font-medium">Quick Demo Accounts:</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={fillResearcher}
                className="flex-1 py-1.5 px-3 text-xs bg-forest-700/60 hover:bg-forest-700 text-emerald-300 rounded-lg border border-forest-600/40 flex items-center justify-center gap-1.5 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" /> Researcher
              </button>
              <button
                type="button"
                onClick={fillAdmin}
                className="flex-1 py-1.5 px-3 text-xs bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 rounded-lg border border-emerald-800/40 flex items-center justify-center gap-1.5 transition-colors font-medium"
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Admin
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="researcher@agriscience.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-forest-800/90 border border-forest-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-forest-800/90 border border-forest-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-forest-950 font-semibold text-sm rounded-xl transition-all shadow-glow hover:shadow-glow-lg flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {isSubmitting ? 'Authenticating...' : 'Sign In'}
              </button>
            </div>
          </form>

          <div className="text-center text-xs text-gray-400 pt-2 border-t border-forest-800">
            Role matching: <code className="text-emerald-400 font-mono">b.obaga@landscapealliance.org</code> / <code className="text-emerald-400 font-mono">admin@acaicia.org</code> grants Admin role.
          </div>
        </div>
      </div>
    </div>
  );
};
