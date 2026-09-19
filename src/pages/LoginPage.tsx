import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { User, Lock, Eye, EyeOff, Users, ShieldCheck, Calendar, AlertCircle } from 'lucide-react'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const executeLogin = async (userToLogin: string, passToLogin: string) => {
    setError('')
    setIsSubmitting(true)
    const { success, error: authError, user } = await login(userToLogin, passToLogin)
    setIsSubmitting(false)
    if (success && user) {
      const defaultRoute = user.role === 'Receptionist' ? '/reception-desk' : '/dashboard'
      navigate(defaultRoute, { replace: true })
    } else {
      setError(authError || 'Invalid username or password')
    }
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password')
      return
    }
    executeLogin(username.trim(), password)
  }


  return (
    <div
      className="min-h-screen w-full relative bg-slate-100 flex flex-col justify-between overflow-y-auto lg:h-screen lg:overflow-hidden bg-cover bg-center bg-no-repeat selection:bg-teal-500 selection:text-white"
      style={{ backgroundImage: "url('/dental-bg.png')" }}
    >
      {/* Main Content Grid */}
      <div className="relative z-10 w-full flex-1 max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 py-3 sm:py-5 flex flex-col lg:flex-row items-center justify-between gap-8 min-h-0">

        {/* Left Hero & Branding Section - Shifted to the left side */}
        <div className="w-full lg:max-w-[450px] xl:max-w-[480px] flex flex-col items-start text-left space-y-4 sm:space-y-5 lg:h-full justify-start pt-1 sm:pt-3 pb-2 z-10">

          {/* Top: Broad Logo - Exactly -55px left shift */}
          <div className="w-72 sm:w-80 md:w-[350px] max-w-full transition-transform hover:scale-[1.01] duration-300" style={{ marginLeft: '-55px' }}>
            <img
              src="/dental-logo.png"
              alt="Rafi Dental Clinic"
              className="w-full h-auto object-contain drop-shadow-sm"
            />
          </div>

          {/* Headline, Subtitle & Badges with radiant soft white daylight glare - Shifted right to clear leaves */}
          <div className="relative w-full flex flex-col items-start text-left pt-1" style={{ marginLeft: '38px' }}>
            {/* Soft radiant white daylight glare bloom directly behind this section */}
            <div className="absolute -inset-x-8 -inset-y-6 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.85)_0%,_rgba(255,255,255,0.45)_50%,_transparent_75%)] blur-2xl pointer-events-none -z-10" />

            {/* Middle: Headline & Subtitle - Left aligned */}
            <div className="space-y-2 select-none text-left">
              <div className="space-y-0.5">
                <h1 className="text-3xl sm:text-4xl lg:text-[45px] font-extrabold text-[#0f3b56] tracking-tight leading-[1.06]">
                  Your Smile
                </h1>
                <h1 className="text-3xl sm:text-4xl lg:text-[45px] font-extrabold text-[#008985] tracking-tight leading-[1.06]" style={{ marginLeft: '40px' }}>
                  Our Priority
                </h1>
              </div>
              <p style={{ marginLeft: '40px' }} className="text-[#3b576c] text-xs sm:text-sm font-medium leading-relaxed max-w-sm mt-1.5 text-left">
                Compassionate care. Modern dentistry.<br />
                Healthier smiles for a brighter tomorrow.
              </p>
            </div>

            {/* 3 Circular Feature Badges - Left-aligned row */}
            <div style={{ marginLeft: '40px' }} className="flex items-start justify-start gap-4 sm:gap-6 pt-3 sm:pt-4">
              {/* Feature 1 */}
              <div className="flex flex-col items-center text-center group">
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] flex items-center justify-center border border-slate-100/90 group-hover:scale-105 group-hover:shadow-md transition-all duration-300">
                  <ShieldCheck className="w-6 h-6 text-[#0f3b56]" strokeWidth={1.8} />
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-[#0f3b56] mt-2 leading-tight text-center">
                  Trusted<br />Dental Care
                </span>
              </div>

              {/* Feature 2 */}
              <div className="flex flex-col items-center text-center group">
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] flex items-center justify-center border border-slate-100/90 group-hover:scale-105 group-hover:shadow-md transition-all duration-300">
                  <Calendar className="w-6 h-6 text-[#0f3b56]" strokeWidth={1.8} />
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-[#0f3b56] mt-2 leading-tight text-center">
                  Convenient<br />Appointments
                </span>
              </div>

              {/* Feature 3 */}
              <div className="flex flex-col items-center text-center group">
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] flex items-center justify-center border border-slate-100/90 group-hover:scale-105 group-hover:shadow-md transition-all duration-300">
                  <Users className="w-6 h-6 text-[#0f3b56]" strokeWidth={1.8} />
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-[#0f3b56] mt-2 leading-tight text-center">
                  A Healthier<br />Happier You
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Floating Card */}
        <div className="w-full lg:w-auto lg:min-w-[420px] xl:min-w-[450px] max-w-lg">
          <div className="bg-white/95 backdrop-blur-xl rounded-[28px] p-6 sm:p-7 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.22)] border border-white/80 transition-all">

            {/* Card Header */}
            <div className="text-center space-y-1.5 mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Welcome Back
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Sign in to your Rafi Dental Clinic account
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-3.5">
              {/* Username Input */}
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-semibold text-slate-700">
                  Username
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <Input
                    id="username"
                    type="text"
                    placeholder="e.g. receptionist"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isSubmitting}
                    className="pl-10 h-11 bg-white border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:border-teal-600 focus:ring-teal-600/20 shadow-xs"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="pl-10 pr-10 h-11 bg-white border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:border-teal-600 focus:ring-teal-600/20 shadow-xs"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-1.5">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 bg-[#008b8b] hover:bg-[#007575] text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all text-sm cursor-pointer disabled:opacity-70"
                >
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </Button>
              </div>
            </form>

            {/* Motivational Quote & Mini Smile */}
            <div className="text-center mt-6 pt-1 select-none">
              <p className="text-xs italic text-slate-500 font-serif">
                “Caring for smiles today, tomorrow and always.”
              </p>
              <svg className="w-13 h-3 mx-auto text-teal-600 mt-0.5" viewBox="0 0 60 14" fill="none">
                <path d="M6 3C22 11 38 11 54 3" stroke="#008b8b" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>

          </div>
        </div>

      </div>

      {/* Footer Bar */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 pb-2.5 pt-1 flex flex-col sm:flex-row items-center justify-between text-[11px] sm:text-xs text-slate-700 font-medium gap-1 shrink-0">
        <div>
          © 2026 Scripters Zone. All rights reserved.
        </div>
        {/* <div className="flex items-center gap-4 text-slate-700">
          <button type="button" className="hover:text-slate-950 transition-colors cursor-pointer">Privacy</button>
          <span>|</span>
          <button type="button" className="hover:text-slate-950 transition-colors cursor-pointer">Terms</button>
          <span>|</span>
          <button type="button" className="hover:text-slate-950 transition-colors cursor-pointer">Help</button>
        </div> */}
      </div>

    </div>
  )
}
