import { useState } from 'react';

const initialForm = {
  email: '',
  password: '',
};

export default function LoginForm() {
  const [formData, setFormData] = useState(initialForm);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    console.log('Login submitted:', formData);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-red-300/80">
          Welcome back
        </p>
        <h2 className="text-3xl font-bold text-white">Sign in</h2>
      </div>

      <div className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-red-100/80">Email</span>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="name@example.com"
            className="w-full rounded-xl border border-red-500/30 bg-slate-900/80 px-4 py-3 text-white placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-red-100/80">Password</span>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            className="w-full rounded-xl border border-red-500/30 bg-slate-900/80 px-4 py-3 text-white placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          />
        </label>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-300">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 rounded border-red-400 bg-slate-900 text-red-500 focus:ring-red-500" />
          Remember me
        </label>
        <button type="button" className="font-medium text-red-300 transition hover:text-red-200">
          Forgot password?
        </button>
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-gradient-to-red from-red-600 via-red-500 to-rose-500 px-4 py-3 font-semibold text-white shadow-lg shadow-red-900/40 transition hover:brightness-110"
      >
        Login
      </button>
    </form>
  );
}
