'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/services/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldCheck, Moon, Sun, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

export default function LoginForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [state, formAction, isPending] = useActionState(signIn, null)

  const [darkMode, setDarkMode] = React.useState(true)

  useEffect(() => {
    // Synchronize HTML dark class
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  useEffect(() => {
    if (state?.success) {
      toast({
        title: 'Logged in successfully',
        description: `Redirecting to your dashboard...`,
        type: 'success',
      })
      
      // Perform redirect based on role
      if (state.role === 'Admin') {
        router.push('/admin/dashboard')
      } else if (state.role === 'Sub Admin') {
        router.push('/sub-admin/dashboard')
      } else {
        router.push('/dashboard')
      }
      router.refresh()
    } else if (state?.error) {
      toast({
        title: 'Authentication Failed',
        description: state.error,
        type: 'error',
      })
    }
  }, [state, router, toast])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50 transition-colors duration-200">
      
      {/* Dark/Light mode toggle */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="absolute top-4 right-4 p-2 rounded-full border border-neutral-200 bg-white shadow-sm hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800 transition-colors duration-150 cursor-pointer"
        aria-label="Toggle Theme"
      >
        {darkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-neutral-500" />}
      </button>

      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="p-2 bg-neutral-900 text-neutral-50 rounded-lg dark:bg-neutral-50 dark:text-neutral-900">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">RO Tracker</span>
        </div>

        <Card className="border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/50 backdrop-blur-md shadow-lg overflow-hidden">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loginInput">Username or Email</Label>
                <Input
                  id="loginInput"
                  name="loginInput"
                  placeholder="e.g. ro001 or admin@ro-tracking.com"
                  required
                  autoComplete="username"
                  className="bg-neutral-50/50 dark:bg-neutral-950/50"
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Password"
                  required
                  autoComplete="current-password"
                  className="bg-neutral-50/50 dark:bg-neutral-950/50"
                  disabled={isPending}
                />
              </div>

              {state?.error && (
                <div className="p-3 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 rounded-lg text-xs font-medium border border-red-100 dark:border-red-900/50">
                  {state.error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full mt-2"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo Helper Information */}
        <div className="mt-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
          <p className="font-semibold mb-1">Demo Accounts:</p>
          <p>Admin: <code className="text-neutral-800 dark:text-neutral-200">admin@ro-tracking.com</code> / <code className="text-neutral-800 dark:text-neutral-200">PazzyAdmin123</code></p>
          <p>Sub Admin: <code className="text-neutral-800 dark:text-neutral-200">subadmin@ro-tracking.com</code> / <code className="text-neutral-800 dark:text-neutral-200">PazzySubAdmin123</code></p>
          <p>Recovery Officer: <code className="text-neutral-800 dark:text-neutral-200">ro001</code> to <code className="text-neutral-800 dark:text-neutral-200">ro030</code> / <code className="text-neutral-800 dark:text-neutral-200">PazzyRO123</code></p>
        </div>
      </div>
    </div>
  )
}
