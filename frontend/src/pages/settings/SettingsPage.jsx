import { useState, useEffect } from 'react';
import {
  Settings, Users, GitBranch, Shield, Store, Save,
  Loader2, Plus, X, Eye, EyeOff, Check, Edit, Trash2
} from 'lucide-react';
import { settingsAPI, staffAPI, branchesAPI } from '../../utils/api';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'shop', label: 'Shop Profile', icon: Store },
  { id: 'billing', label: 'Billing & GST', icon: Settings },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'branches', label: 'Branches', icon: GitBranch },
  { id: 'security', label: 'Security', icon: Shield },
];

const MOCK_SETTINGS = {
  enableGst: true,
  defaultGstPercent: 18,
  invoicePrefix: 'INV',
  enableBarcode: true,
  lowStockAlert: true,
  currency: 'INR',
  decimalPlaces: 2,
  thermalPrintWidth: 58,
};

const MOCK_STAFF = [
  { id: 'st1', name: 'Ramesh (Manager)', email: 'ramesh@shop.com', mobile: '9876543210', role: 'MANAGER' },
  { id: 'st2', name: 'Suresh (Cashier)', email: 'suresh@shop.com', mobile: '8765432109', role: 'STAFF' },
];

const MOCK_BRANCHES = [
  { id: 'b1', name: 'Main Branch', address: 'MG Road, Bangalore', mobile: '9876543210', isMain: true },
  { id: 'b2', name: 'Branch 2', address: 'Whitefield, Bangalore', mobile: '8765432109', isMain: false },
];

const ROLES = ['MANAGER', 'STAFF', 'CASHIER'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('shop');
  const { user, updateUser } = useAuthStore();

  // Shop profile state
  const [shopForm, setShopForm] = useState({
    name: user?.shopName || '', ownerName: user?.ownerName || '',
    mobile: user?.mobile || '', address: user?.address || '',
    gstNumber: user?.gstNumber || '', businessType: user?.businessType || 'RETAIL',
  });
  const [savingShop, setSavingShop] = useState(false);

  // Billing settings state
  const [settings, setSettings] = useState(MOCK_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);

  // Staff state
  const [staff, setStaff] = useState([]);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);

  // Branches state
  const [branches, setBranches] = useState([]);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);

  // Password state
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    settingsAPI.get().then(r => setSettings({ ...MOCK_SETTINGS, ...r.data })).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'staff') {
      setStaffLoading(true);
      staffAPI.list().then(r => setStaff(r.data || [])).catch(() => setStaff(MOCK_STAFF)).finally(() => setStaffLoading(false));
    }
    if (activeTab === 'branches') {
      setBranchLoading(true);
      branchesAPI.list().then(r => setBranches(r.data || [])).catch(() => setBranches(MOCK_BRANCHES)).finally(() => setBranchLoading(false));
    }
  }, [activeTab]);

  const saveShop = async () => {
    setSavingShop(true);
    try {
      await settingsAPI.updateProfile(shopForm);
      toast.success('Shop profile updated');
    } catch {} finally { setSavingShop(false); }
  };

  const saveBillingSettings = async () => {
    setSavingSettings(true);
    try {
      await settingsAPI.update(settings);
      toast.success('Settings saved');
    } catch {} finally { setSavingSettings(false); }
  };

  const changePassword = async () => {
    if (pwForm.newPassword !== pwForm.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (pwForm.newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSavingPw(true);
    try {
      await settingsAPI.changePassword(pwForm);
      toast.success('Password changed successfully');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch {} finally { setSavingPw(false); }
  };

  const su = (f) => (e) => setShopForm({ ...shopForm, [f]: e.target.value });
  const ss = (f) => (e) => setSettings({ ...settings, [f]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Settings</h1><p className="page-subtitle">Configure your shop preferences</p></div>
      </div>

      <div className="flex gap-5">
        {/* Sidebar tabs */}
        <div className="w-52 flex-shrink-0">
          <div className="card p-2 space-y-0.5">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left
                  ${activeTab === t.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                <t.icon size={16} className={activeTab === t.id ? 'text-blue-600' : 'text-slate-400'} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">

          {/* Shop Profile */}
          {activeTab === 'shop' && (
            <div className="card">
              <div className="card-header"><h3 className="font-semibold text-slate-700">Shop Profile</h3></div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Shop Name', 'name'], ['Owner Name', 'ownerName'],
                    ['Mobile', 'mobile'], ['GST Number', 'gstNumber'],
                  ].map(([label, field]) => (
                    <div key={field}>
                      <label className="label">{label}</label>
                      <input value={shopForm[field] || ''} onChange={su(field)} className="input" />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="label">Address</label>
                    <textarea value={shopForm.address || ''} onChange={su('address')} rows={2} className="input resize-none" />
                  </div>
                  <div>
                    <label className="label">Business Type</label>
                    <select value={shopForm.businessType} onChange={su('businessType')} className="input">
                      {['RETAIL', 'WHOLESALE', 'HYBRID'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={saveShop} disabled={savingShop} className="btn-primary">
                    {savingShop ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {savingShop ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Billing & GST */}
          {activeTab === 'billing' && (
            <div className="card">
              <div className="card-header"><h3 className="font-semibold text-slate-700">Billing & GST Settings</h3></div>
              <div className="card-body space-y-5">
                {/* Toggles */}
                <div className="space-y-3">
                  {[
                    { key: 'enableGst', label: 'Enable GST', desc: 'Calculate and display GST on invoices' },
                    { key: 'enableBarcode', label: 'Barcode Support', desc: 'Enable barcode scanner in sale/purchase' },
                    { key: 'lowStockAlert', label: 'Low Stock Alerts', desc: 'Alert when stock reaches minimum level' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{label}</p>
                        <p className="text-xs text-slate-500">{desc}</p>
                      </div>
                      <button
                        onClick={() => setSettings({ ...settings, [key]: !settings[key] })}
                        className={`relative w-10 h-5 rounded-full transition-colors ${settings[key] ? 'bg-blue-600' : 'bg-slate-300'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Settings inputs */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="label">Invoice Prefix</label>
                    <input value={settings.invoicePrefix || ''} onChange={ss('invoicePrefix')} placeholder="INV" className="input" />
                  </div>
                  <div>
                    <label className="label">Default GST %</label>
                    <select value={settings.defaultGstPercent || 18} onChange={ss('defaultGstPercent')} className="input">
                      {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Thermal Printer Width (mm)</label>
                    <select value={settings.thermalPrintWidth || 70} onChange={ss('thermalPrintWidth')} className="input">
                      <option value={58}>58mm</option>
                      <option value={70}>70mm</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Decimal Places</label>
                    <select value={settings.decimalPlaces ?? 2} onChange={ss('decimalPlaces')} className="input">
                      <option value={0}>0</option>
                      <option value={2}>2</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button onClick={saveBillingSettings} disabled={savingSettings} className="btn-primary">
                    {savingSettings ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {savingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Staff */}
          {activeTab === 'staff' && (
            <div className="card overflow-hidden">
              <div className="card-header">
                <h3 className="font-semibold text-slate-700">Staff Members</h3>
                <button onClick={() => setShowStaffForm(true)} className="btn-primary btn-sm gap-1"><Plus size={14} />Add Staff</button>
              </div>
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th className="text-center">Role</th><th className="text-center">Actions</th></tr></thead>
                  <tbody>
                    {staffLoading ? (
                      <tr><td colSpan={5} className="text-center py-10"><Loader2 size={20} className="animate-spin text-blue-500 mx-auto" /></td></tr>
                    ) : staff.map(s => (
                      <tr key={s.id}>
                        <td className="font-medium">{s.name}</td>
                        <td className="text-slate-500 text-sm">{s.email}</td>
                        <td className="text-slate-500 text-sm">{s.mobile || '—'}</td>
                        <td className="text-center">
                          <span className={s.role === 'MANAGER' ? 'badge-blue' : s.role === 'CASHIER' ? 'badge-green' : 'badge-slate'}>{s.role}</span>
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            <button className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Edit size={14} /></button>
                            <button className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Branches */}
          {activeTab === 'branches' && (
            <div className="card overflow-hidden">
              <div className="card-header">
                <h3 className="font-semibold text-slate-700">Branches</h3>
                <button onClick={() => setShowBranchForm(true)} className="btn-primary btn-sm gap-1"><Plus size={14} />Add Branch</button>
              </div>
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Branch Name</th><th>Address</th><th>Mobile</th><th className="text-center">Type</th></tr></thead>
                  <tbody>
                    {branchLoading ? (
                      <tr><td colSpan={4} className="text-center py-10"><Loader2 size={20} className="animate-spin text-blue-500 mx-auto" /></td></tr>
                    ) : branches.map(b => (
                      <tr key={b.id}>
                        <td className="font-medium">{b.name}</td>
                        <td className="text-slate-500 text-sm">{b.address || '—'}</td>
                        <td className="text-slate-500 text-sm">{b.mobile || '—'}</td>
                        <td className="text-center"><span className={b.isMain ? 'badge-blue' : 'badge-slate'}>{b.isMain ? 'Main' : 'Branch'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Security */}
          {activeTab === 'security' && (
            <div className="card">
              <div className="card-header"><h3 className="font-semibold text-slate-700">Change Password</h3></div>
              <div className="card-body space-y-4 max-w-md">
                <div className="relative">
                  <label className="label">Current Password</label>
                  <input type={showPw ? 'text' : 'password'} value={pwForm.currentPassword}
                    onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} className="input pr-10" />
                  <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-8 text-slate-400">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div>
                  <label className="label">New Password</label>
                  <input type={showPw ? 'text' : 'password'} value={pwForm.newPassword}
                    onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">Confirm New Password</label>
                  <input type={showPw ? 'text' : 'password'} value={pwForm.confirmPassword}
                    onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })} className="input" />
                  {pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={changePassword} disabled={savingPw || !pwForm.currentPassword || !pwForm.newPassword} className="btn-primary">
                    {savingPw ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />}
                    {savingPw ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Staff Modal */}
      {showStaffForm && (
        <StaffModal onClose={() => setShowStaffForm(false)}
          onSaved={() => { setShowStaffForm(false); staffAPI.list().then(r => setStaff(r.data || [])).catch(() => {}); }} />
      )}

      {/* Add Branch Modal */}
      {showBranchForm && (
        <BranchModal onClose={() => setShowBranchForm(false)}
          onSaved={() => { setShowBranchForm(false); branchesAPI.list().then(r => setBranches(r.data || [])).catch(() => {}); }} />
      )}
    </div>
  );
}

function StaffModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', mobile: '', password: '', role: 'STAFF' });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const u = f => e => setForm({ ...form, [f]: e.target.value });

  const handleSave = async () => {
    if (!form.name || !form.email || !form.password) { toast.error('Name, email and password are required'); return; }
    setSaving(true);
    try { await staffAPI.create(form); toast.success('Staff added'); onSaved(); } catch {} finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold">Add Staff Member</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-5 space-y-3">
            {[['Name *', 'name'], ['Email *', 'email'], ['Mobile', 'mobile']].map(([label, field]) => (
              <div key={field}><label className="label">{label}</label><input value={form[field]} onChange={u(field)} className="input" /></div>
            ))}
            <div>
              <label className="label">Role</label>
              <select value={form.role} onChange={u('role')} className="input">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="relative">
              <label className="label">Password *</label>
              <input type={showPw ? 'text' : 'password'} value={form.password} onChange={u('password')} className="input pr-10" />
              <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-8 text-slate-400">{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            </div>
          </div>
          <div className="px-5 pb-5 flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}{saving ? 'Adding...' : 'Add Staff'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function BranchModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', address: '', mobile: '' });
  const [saving, setSaving] = useState(false);
  const u = f => e => setForm({ ...form, [f]: e.target.value });

  const handleSave = async () => {
    if (!form.name) { toast.error('Branch name is required'); return; }
    setSaving(true);
    try { await branchesAPI.create(form); toast.success('Branch added'); onSaved(); } catch {} finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold">Add Branch</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-5 space-y-3">
            {[['Branch Name *', 'name'], ['Address', 'address'], ['Mobile', 'mobile']].map(([label, field]) => (
              <div key={field}><label className="label">{label}</label><input value={form[field]} onChange={u(field)} className="input" /></div>
            ))}
          </div>
          <div className="px-5 pb-5 flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}{saving ? 'Adding...' : 'Add Branch'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
