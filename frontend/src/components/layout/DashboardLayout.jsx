import { useState, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import ErrorBoundary from '../ErrorBoundary';
import {
  LayoutDashboard, ShoppingCart, Package, PackagePlus,
  BarChart3, BookOpen, Users, Truck, Settings, Store,
  GitBranch, LogOut, Menu, X, Bell, ChevronDown,
  Eye, EyeOff, TrendingUp, UserCheck, Receipt, Lock, AlertTriangle, Trophy
} from 'lucide-react';
import usePrivacyStore from '../../store/privacyStore';
import useAuthStore from '../../store/authStore';

const NAV_ITEMS = [
  { path: '/dashboard',              icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/sale',                   icon: ShoppingCart,    label: 'Sale Screen' },
  { path: '/bill-history',           icon: BookOpen,        label: 'Bill History' },
  { path: '/purchase',               icon: Package,         label: 'Purchase' },
  { path: '/stock',                  icon: TrendingUp,      label: 'Stock Update' },
  { path: '/products',               icon: PackagePlus,     label: 'Products' },
  { path: '/barcodes',               icon: Package,         label: 'Barcodes' },
  { path: '/reports',                icon: BarChart3,       label: 'Store Report' },
  { path: '/reports/dead-stock',     icon: AlertTriangle,   label: 'Dead Stock' },
  { path: '/reports/best-selling',   icon: Trophy,          label: 'Best Sellers' },
  { path: '/ledger',                 icon: BookOpen,        label: 'Ledger' },
  { path: '/customers',              icon: Users,           label: 'Customers' },
  { path: '/suppliers',              icon: Truck,           label: 'Suppliers' },
  { path: '/salesmen',               icon: UserCheck,       label: 'Salesmen' },
  { path: '/drivers',                icon: Truck,           label: 'Drivers' },
  { path: '/expenses',               icon: Receipt,         label: 'Expenses' },
  { path: '/cash-closing',           icon: Lock,            label: 'Cash Closing' },
  { path: '/settings',               icon: Settings,        label: 'Settings' },
  { path: '/franchise',              icon: GitBranch,       label: 'Franchise' },
];

function Sidebar({ sidebarOpen, setSidebarOpen, mobile = false, onMobileClose, user, onLogout }) {
  return (
    <aside className={`flex flex-col h-full bg-slate-900 text-white ${mobile ? 'w-72' : sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-200`}>
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-700/50 ${!sidebarOpen && !mobile ? 'justify-center' : ''}`}>
        {(sidebarOpen || mobile) && (
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Store size={18} className="text-white" />
          </div>
        )}
        {(sidebarOpen || mobile) && (
          <div>
            <div className="font-bold text-sm">POS Counter</div>
            <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[140px]">{user?.name || 'My Shop'}</div>
          </div>
        )}
        {!mobile && (
          <button
            onClick={() => setSidebarOpen(p => !p)}
            className={`text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors ${
              sidebarOpen ? 'ml-auto' : ''
            }`}
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            <Menu size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
          <NavLink key={path} to={path} end={path === '/reports'}
            onClick={() => mobile && onMobileClose()}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-all
               ${isActive ? 'bg-blue-600/20 text-blue-400 font-medium' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
            }>
            <Icon size={18} className="flex-shrink-0" />
            {(sidebarOpen || mobile) && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-700/50">
        {(sidebarOpen || mobile) ? (
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
              {user?.ownerName?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.ownerName}</div>
              <div className="text-xs text-slate-400 truncate">{user?.email}</div>
            </div>
            <button onClick={onLogout} className="text-slate-400 hover:text-red-400 p-1" title="Logout"><LogOut size={15} /></button>
          </div>
        ) : (
          <button onClick={onLogout} className="w-full flex justify-center p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800" title="Logout">
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  );
}

// ── Draggable Reveal Button ────────────────────────────────
function DraggableRevealBtn({ isRevealed, toggle }) {
  const STORAGE_KEY = 'reveal_btn_pos';

  const getInitialPos = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') return saved;
    } catch {}
    // Default: bottom-right corner
    return { x: window.innerWidth - 140, y: window.innerHeight - 70 };
  };

  const [pos, setPos] = useState(getInitialPos);
  const dragging = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const btnRef = useRef(null);

  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

  const savePos = (p) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  };

  // ── Mouse events ──────────────────────────────────────────
  const onMouseDown = (e) => {
    e.preventDefault();
    dragging.current = true;
    moved.current = false;
    startMouse.current = { x: e.clientX, y: e.clientY };
    startPos.current = { ...pos };

    const onMouseMove = (e) => {
      if (!dragging.current) return;
      const dx = e.clientX - startMouse.current.x;
      const dy = e.clientY - startMouse.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
      const bw = btnRef.current?.offsetWidth || 120;
      const bh = btnRef.current?.offsetHeight || 40;
      const newPos = {
        x: clamp(startPos.current.x + dx, 0, window.innerWidth - bw),
        y: clamp(startPos.current.y + dy, 0, window.innerHeight - bh),
      };
      setPos(newPos);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      // Save final pos
      setPos(prev => { savePos(prev); return prev; });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // ── Touch events ──────────────────────────────────────────
  const onTouchStart = (e) => {
    const t = e.touches[0];
    dragging.current = true;
    moved.current = false;
    startMouse.current = { x: t.clientX, y: t.clientY };
    startPos.current = { ...pos };
  };

  const onTouchMove = (e) => {
    if (!dragging.current) return;
    e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - startMouse.current.x;
    const dy = t.clientY - startMouse.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
    const bw = btnRef.current?.offsetWidth || 120;
    const bh = btnRef.current?.offsetHeight || 40;
    setPos({
      x: clamp(startPos.current.x + dx, 0, window.innerWidth - bw),
      y: clamp(startPos.current.y + dy, 0, window.innerHeight - bh),
    });
  };

  const onTouchEnd = () => {
    dragging.current = false;
    setPos(prev => { savePos(prev); return prev; });
  };

  const handleClick = () => {
    if (!moved.current) toggle();
  };

  return (
    <button
      ref={btnRef}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={handleClick}
      title="Drag to move | Click to toggle"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
      }}
      className={`privacy-toggle ${isRevealed ? 'revealed-mode' : 'hidden-mode'}`}
    >
      {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
      <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
    </button>
  );
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { isRevealed, toggle } = usePrivacyStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-col flex-shrink-0">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} user={user} onLogout={handleLogout} />
      </div>

      {/* Mobile Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative z-10">
            <Sidebar sidebarOpen mobile onMobileClose={() => setMobileSidebarOpen(false)} user={user} onLogout={handleLogout} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-4 flex-shrink-0">
          {/* Mobile menu button */}
          <button className="lg:hidden text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg" onClick={() => setMobileSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          {/* Desktop: show open button ONLY when sidebar is collapsed */}
          {!sidebarOpen && (
            <button
              className="hidden lg:flex items-center justify-center text-slate-600 hover:text-slate-900 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}
              title="Open sidebar"
            >
              {/* <Menu size={20} /> */}
            </button>
          )}
          <div id="header-portal-target" className="flex-1 flex h-full items-end overflow-hidden" />
          <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          <div className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5">
            <Store size={14} />
            <span className="hidden sm:block font-medium">{user?.name}</span>
            <ChevronDown size={14} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Privacy Toggle — Draggable */}
      <DraggableRevealBtn isRevealed={isRevealed} toggle={toggle} />
    </div>
  );
}
