'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // TODO: Later we will call /api/auth/register here
    console.log('Register attempt:', { name, email, password });
    alert('✅ Register API will be connected in the next step!');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
      <Card className="w-full max-w-md bg-[#1e2937] border-slate-700">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-3xl flex items-center justify-center text-4xl">🔀</div>
          </div>
          <CardTitle className="text-3xl font-bold text-white">Join SplitEasy</CardTitle>
          <CardDescription className="text-slate-400">
            Create your account in 30 seconds
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-slate-900 border-slate-600 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-900 border-slate-600 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-900 border-slate-600 text-white"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-6 text-lg font-semibold"
            >
              {loading ? 'Creating account...' : 'Create free account'}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm">
            <span className="text-slate-400">Already have an account? </span>
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
