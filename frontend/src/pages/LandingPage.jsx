import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Store, BarChart3, Package, Users, Truck, ShieldCheck,
  ArrowRight, ChevronDown, Zap, Globe, Receipt, TrendingUp,
  Star, CheckCircle2, Sparkles, Menu, X, Gift, UserCog
} from 'lucide-react';

/* ─── Animated counter hook ─── */
function useCounter(target, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

/* ─── Scroll reveal hook ─── */
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

const features = [
  { icon: Receipt, color: 'from-blue-500 to-cyan-500', title: 'Smart Billing', desc: 'Lightning-fast POS billing with multi-unit support, barcode scanning, and instant invoice generation.' },
  { icon: Package, color: 'from-violet-500 to-purple-600', title: 'Stock & Inventory', desc: 'Real-time stock tracking with multi-unit hierarchy, dead stock alerts, and low-stock notifications.' },
  { icon: BarChart3, color: 'from-emerald-500 to-teal-500', title: 'Sales Reports', desc: 'Powerful analytics — daily sales, best-selling items, profit & loss, and ledger management.' },
  { icon: Truck, color: 'from-orange-500 to-amber-500', title: 'Driver POS', desc: 'Dedicated mobile POS for delivery drivers with vehicle-wise cash closing and settlement.' },
  { icon: Users, color: 'from-pink-500 to-rose-500', title: 'Customer Ledger', desc: 'Manage customer credit, track due balances, and maintain complete purchase history.' },
  { icon: Globe, color: 'from-sky-500 to-indigo-500', title: 'Cloud Sync', desc: 'All data backed up in the cloud. Access your business from anywhere, anytime.' },
  { icon: Gift, color: 'from-yellow-500 to-orange-500', title: 'Loyalty Program', desc: 'Reward your customers with loyalty points on every purchase. Boost retention and drive repeat sales automatically.' },
  { icon: UserCog, color: 'from-teal-500 to-green-500', title: 'Staff Management', desc: 'Manage staff roles, track salesman performance, set permissions, and monitor daily activities with ease.' },
];

const steps = [
  { num: '01', title: 'Create your account', desc: 'Register your shop in seconds — no credit card required.' },
  { num: '02', title: 'Add your products', desc: 'Import or add products with units, pricing tiers, and barcodes.' },
  { num: '03', title: 'Start selling', desc: 'Bill customers instantly, track stock, and grow your business.' },
];

const testimonials = [
  { name: 'Ramesh Kumar', role: 'Kirana Store Owner, Delhi', stars: 5, text: '"POS Counter transformed how I manage my shop. Stock alerts and billing are now effortless!"' },
  { name: 'Priya Mehta', role: 'Wholesale Distributor, Mumbai', stars: 5, text: '"The driver POS feature is a game-changer. My delivery team\'s collections are now 100% accurate."' },
  { name: 'Arjun Singh', role: 'Supermarket Owner, Pune', stars: 5, text: '"Best investment for my business. Reports and ledger management save me hours every week."' },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [statsRef, statsInView] = useInView();
  const shops   = useCounter(5000, 2000, statsInView);
  const bills   = useCounter(2000000, 2200, statsInView);
  const uptime  = useCounter(99, 1500, statsInView);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#040b1a] text-white font-sans overflow-x-hidden">
      {/* ══ Navbar ══════════════════════════════════════════════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#040b1a]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center h-12">
            <img src="/Sitelayers__logo.png" height="245" width="245" />
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            {[['features','Features'],['how-it-works','How it Works'],['pricing','Why Us']].map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="hover:text-white transition-colors duration-200">{label}</button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login"
              className="text-sm text-slate-300 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-all">
              Sign In
            </Link>
            <Link to="/register"
              className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500
                         text-white px-5 py-2 rounded-lg shadow-lg shadow-blue-600/30 transition-all duration-200">
              Get Started Free
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setMenuOpen(v => !v)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#040b1a]/95 px-6 py-4 flex flex-col gap-4 text-sm text-slate-300">
            {[['features','Features'],['how-it-works','How it Works'],['pricing','Why Us']].map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)} className="text-left hover:text-white">{label}</button>
            ))}
            <hr className="border-white/10" />
            <Link to="/login" className="hover:text-white">Sign In</Link>
            <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-center font-semibold">Get Started Free</Link>
          </div>
        )}
      </nav>

      {/* ══ Hero ════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20 pb-16 overflow-hidden">
        {/* Ambient blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[900px] h-[900px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-600/8 rounded-full blur-[100px] pointer-events-none" />

        {/* Grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

        {/* Badge */}
        <div className="relative inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 text-blue-300 text-xs font-semibold px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
          <Sparkles size={13} />
          India's Smart Cloud Point of Sale System
          <Sparkles size={13} />
        </div>

        {/* Headline */}
        <h1 className="relative text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight max-w-5xl">
          <span className="text-white">Run Your Business{' '}</span>
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
            Smarter &amp; Faster
          </span>
        </h1>

        <p className="relative text-slate-400 text-lg sm:text-xl max-w-2xl mt-6 leading-relaxed">
          Complete Point of Sale solution — billing, inventory, driver POS, sales reports, customer ledger &amp; more. Built for kirana stores, supermarkets &amp; wholesalers.
        </p>

        {/* CTAs */}
        <div className="relative flex flex-col sm:flex-row items-center gap-4 mt-10">
          <Link to="/register"
            className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500
                       text-white font-bold text-base px-8 py-4 rounded-2xl shadow-2xl shadow-blue-600/40 transition-all duration-300 hover:scale-105 hover:shadow-blue-500/50">
            Start for Free
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link to="/login"
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20
                       text-slate-300 hover:text-white font-semibold text-base px-8 py-4 rounded-2xl transition-all duration-300">
            <Store size={17} />
            Sign In to Dashboard
          </Link>
        </div>

        {/* Social proof */}
        <div className="relative flex items-center gap-6 mt-12 text-sm text-slate-500">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-500" />
            No credit card required
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-500" />
            Free forever plan
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-px h-4 bg-white/10" />
            <CheckCircle2 size={15} className="text-emerald-500" />
            Live in 2 minutes
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-600 text-xs animate-bounce">
          <span>Scroll to explore</span>
          <ChevronDown size={18} />
        </div>
      </section>

      {/* ══ Stats ═══════════════════════════════════════════════ */}
      <section ref={statsRef} className="relative py-20 border-y border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-cyan-900/10 pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-3 gap-10 text-center">
          {[
            { val: shops,  suffix: '+', label: 'Shops Using POS Counter', sub: 'Across India' },
            { val: bills,  suffix: '+', label: 'Bills Generated', sub: 'And counting' },
            { val: uptime, suffix: '.9%', label: 'Uptime Guarantee', sub: 'Always available' },
          ].map(({ val, suffix, label, sub }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <span className="text-5xl font-extrabold bg-gradient-to-b from-white to-blue-300 bg-clip-text text-transparent">
                {val.toLocaleString()}{suffix}
              </span>
              <span className="text-white font-semibold mt-2">{label}</span>
              <span className="text-slate-500 text-sm">{sub}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══ Features ════════════════════════════════════════════ */}
      <section id="features" className="relative py-28 px-6 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">Everything you need</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white">Powerful Features for<br />Every Business</h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto">From a small kirana to a large wholesale business — POS Counter grows with you.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, color, title, desc }, i) => (
              <div key={i}
                className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-white/[0.14]
                           rounded-2xl p-6 transition-all duration-300 hover:translate-y-[-4px] hover:shadow-2xl hover:shadow-black/30 cursor-default">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-5 shadow-lg`}>
                  <Icon size={22} className="text-white" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${color} blur-xl -z-10 scale-95`} style={{opacity:0}} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ How It Works ════════════════════════════════════════ */}
      <section id="how-it-works" className="relative py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-cyan-400 text-sm font-semibold uppercase tracking-widest mb-3">Simple onboarding</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white">Up and running in<br />3 easy steps</h2>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Line connector */}
            <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

            {steps.map(({ num, title, desc }, i) => (
              <div key={i} className="relative flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/20 flex items-center justify-center mb-6 shadow-xl shadow-blue-900/20">
                  <span className="text-3xl font-black text-transparent bg-gradient-to-br from-blue-400 to-cyan-400 bg-clip-text">{num}</span>
                </div>
                <h3 className="text-white font-bold text-xl mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Testimonials ════════════════════════════════════════ */}
      <section id="pricing" className="relative py-28 px-6 overflow-hidden">
        <div className="absolute bottom-0 left-0 w-[600px] h-[400px] bg-violet-700/8 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">Loved by businesses</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white">What our customers say</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map(({ name, role, stars, text }, i) => (
              <div key={i}
                className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 flex flex-col gap-4 hover:border-white/[0.14] transition-all duration-300">
                <div className="flex gap-1">
                  {Array.from({ length: stars }).map((_, j) => (
                    <Star key={j} size={14} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed italic">{text}</p>
                <div className="border-t border-white/5 pt-4 mt-auto">
                  <p className="text-white font-semibold text-sm">{name}</p>
                  <p className="text-slate-500 text-xs">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Why Choose Us ═══════════════════════════════════════ */}
      <section className="relative py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/20 border border-blue-500/20 rounded-3xl p-8 sm:p-12 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative grid sm:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Why POS Counter?</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Designed specifically for Indian retail businesses. Works offline, syncs automatically when online, and requires zero technical knowledge.
                </p>
                <ul className="space-y-3">
                  {[
                    'Multi-unit & wholesale pricing',
                    'Driver & salesman management',
                    'Staff roles & permissions',
                    'Customer loyalty program',
                    'GST-ready billing',
                    'Works on any device',
                    '24/7 cloud backup',
                    'Free onboarding support',
                  ].map(item => (
                    <li key={item} className="flex items-center gap-3 text-slate-300 text-sm">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <Zap size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold">Instant Setup</p>
                    <p className="text-slate-400 text-xs">Live in under 2 minutes</p>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
                    <ShieldCheck size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold">Secure &amp; Reliable</p>
                    <p className="text-slate-400 text-xs">End-to-end encrypted data</p>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                    <Gift size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold">Loyalty Rewards</p>
                    <p className="text-slate-400 text-xs">Keep customers coming back</p>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center">
                    <TrendingUp size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold">Grow with You</p>
                    <p className="text-slate-400 text-xs">From 1 shop to franchise chains</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ CTA Banner ══════════════════════════════════════════ */}
      <section className="relative py-28 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/10 to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-blue-600/8 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-4">Get started today</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
            Ready to modernize<br />your business?
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Join thousands of smart shop owners. No credit card needed, no complicated setup.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register"
              className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500
                         text-white font-bold text-lg px-10 py-4 rounded-2xl shadow-2xl shadow-blue-600/40 transition-all duration-300 hover:scale-105">
              Create Free Account
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/login"
              className="text-slate-300 hover:text-white font-semibold text-base underline underline-offset-4 decoration-slate-600 hover:decoration-white transition-all">
              Already have an account?
            </Link>
          </div>
        </div>
      </section>

      {/* ══ Footer ══════════════════════════════════════════════ */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Store size={14} className="text-white" />
            </div>
            <span className="text-slate-400 font-semibold">POS Counter</span>
          </div>
          <p>© 2026 POS Counter · All rights reserved</p>
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-slate-300 transition-colors">Login</Link>
            <Link to="/register" className="hover:text-slate-300 transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}