import { useState } from 'react';
import LoginForm from '../features/auth/pages/login';
import RegisterForm from '../features/auth/pages/Register';

const App = () => {
  const [activeForm, setActiveForm] = useState('login');

  return (
    <div className="min-h-screen bg-slate-950 bg-red[radial-gradient(circle_at_top,_rgb(239,68,68,0.22),_transparent_35%),linear-gradient(135deg,#020617_0%,#0f172a_35%,#111827_100%)] px-4 py-10 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-red-500/20 bg-slate-950/80 p-6 shadow-[0_30px_80px_rgba(127,29,29,0.45)] backdrop-blur-xl">
        <div className="mb-8 grid grid-cols-2 gap-2 rounded-2xl bg-slate-900/70 p-2">
          <button
            type="button"
            onClick={() => setActiveForm('login')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeForm === 'login'
                ? 'bg-gradient-to-red from-red-600 to-red-500 text-white shadow-md shadow-red-600/30'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setActiveForm('register')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeForm === 'register'
                ? 'bg-gradient-to-red from-red-600 to-red-500 text-white shadow-md shadow-red-600/30'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        {activeForm === 'login' ? <LoginForm /> : <RegisterForm />}
      </div>
    </div>
  );
};

export default App;
