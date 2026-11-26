import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, Loader2, X, Check, Receipt, IndianRupee, Tag } from 'lucide-react';
import { expensesAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const DEFAULT_CATEGORIES = ['Electricity Bill', 'Shop Rent', 'Staff Salary', 'Transport Cost', 'Maintenance', 'Stationery', 'Other'];

function ExpenseModal({ expense, categories, onClose, onSaved }) {
  const [form, setForm] = useState({
    categoryId: expense?.categoryId || '',
    amount: expense?.amount || '',
    description: expense?.description || '',
    expenseDate: expense?.expenseDate ? format(new Date(expense.expenseDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    notes: expense?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.amount || form.amount <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      if (expense) { await expensesAPI.update(expense.id, form); toast.success('Expense updated'); }
      else { await expensesAPI.create(form); toast.success('Expense added'); }
      onSaved();
    } catch {} finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">{expense ? 'Edit Expense' : 'Add Expense'}</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Category</label>
                <select value={form.categoryId} onChange={e => setForm(f => ({...f, categoryId: e.target.value}))} className="input">
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" value={form.expenseDate} onChange={e => setForm(f => ({...f, expenseDate: e.target.value}))} className="input" />
              </div>
            </div>
            <div>
              <label className="label">Amount (₹) *</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} className="input text-xl font-bold" placeholder="0.00" autoFocus />
            </div>
            <div>
              <label className="label">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} className="input" placeholder="e.g. Electricity bill for March" />
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="input" placeholder="Additional details..." />
            </div>
          </div>
          <div className="px-6 pb-6 flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await expensesAPI.list({ page, startDate: dateFrom, endDate: dateTo, categoryId: catFilter });
      setExpenses(res.data.expenses || []);
      setTotalAmount(res.data.totalAmount || 0);
      setPagination(res.data.pagination || {});
    } catch {} finally { setLoading(false); }
  }, [page, dateFrom, dateTo, catFilter]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
  useEffect(() => {
    expensesAPI.categories().then(r => setCategories(r.data || [])).catch(() => {});
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this expense?')) return;
    try { await expensesAPI.delete(id); toast.success('Expense deleted'); fetchExpenses(); }
    catch {}
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      const res = await expensesAPI.createCategory({ name: newCatName.trim() });
      setCategories(prev => [...prev, res.data]);
      setNewCatName('');
      toast.success('Category added');
    } catch {} finally { setAddingCat(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track business expenses — rent, electricity, salary, etc.</p>
        </div>
        <button onClick={() => { setEditExpense(null); setShowModal(true); }} className="btn-primary"><Plus size={16} /> Add Expense</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="card p-4 bg-red-50">
          <p className="text-xs text-red-500 font-medium">Total Expenses (filtered)</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{fmt(totalAmount)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 font-medium">Total Records</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{pagination.total || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 font-medium">Categories</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{categories.length}</p>
        </div>
      </div>

      {/* Category quick-add + filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3 items-center">
        <select value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1); }} className="input w-44">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="input w-36" />
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="input w-36" />
        <div className="ml-auto flex gap-2">
          <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="New category..." className="input w-40" onKeyDown={e => e.key === 'Enter' && handleAddCategory()} />
          <button onClick={handleAddCategory} disabled={addingCat || !newCatName.trim()} className="btn-secondary gap-1">
            {addingCat ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />} Add
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th className="text-right">Amount</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-14"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-14 text-slate-400">
                  <Receipt size={36} strokeWidth={1} className="mx-auto mb-2" /><p>No expenses found</p>
                </td></tr>
              ) : expenses.map(e => (
                <tr key={e.id}>
                  <td className="text-slate-500 text-xs">{format(new Date(e.expenseDate), 'dd MMM yyyy')}</td>
                  <td>{e.category ? <span className="badge-blue">{e.category.name}</span> : <span className="text-slate-400">—</span>}</td>
                  <td><div className="font-medium text-slate-700">{e.description || '—'}</div>{e.notes && <div className="text-xs text-slate-400">{e.notes}</div>}</td>
                  <td className="text-right font-semibold text-red-600">{fmt(e.amount)}</td>
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setEditExpense(e); setShowModal(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(e.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">{pagination.total} total records</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary btn-sm">Prev</button>
              <span className="px-3 py-1.5 text-xs">{page} / {pagination.pages}</span>
              <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} className="btn-secondary btn-sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {showModal && <ExpenseModal expense={editExpense} categories={categories} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchExpenses(); }} />}
    </div>
  );
}
