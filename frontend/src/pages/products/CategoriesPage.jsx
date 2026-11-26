import { useState, useEffect } from 'react';
import { Plus, Trash2, Tags, Loader2, Edit2, Check, X } from 'lucide-react';
import { categoriesAPI } from '../../utils/api';
import toast from 'react-hot-toast';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    try {
      const res = await categoriesAPI.list();
      setCategories(res.data || []);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await categoriesAPI.create({ name });
      setCategories(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      toast.success(`Category "${name}" added`);
    } catch {
      // global error handler shows toast
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (cat) => {
    setEditId(cat.id);
    setEditName(cat.name);
  };

  const handleEdit = async (id) => {
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await categoriesAPI.update(id, { name });
      setCategories(prev =>
        prev.map(c => c.id === id ? { ...c, name } : c)
           .sort((a, b) => a.name.localeCompare(b.name))
      );
      toast.success('Category updated');
      setEditId(null);
    } catch {
      // global handler
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete category "${name}"? Products in this category will become uncategorised.`)) return;
    try {
      await categoriesAPI.delete(id);
      setCategories(prev => prev.filter(c => c.id !== id));
      toast.success('Category deleted');
    } catch {
      // global handler
    }
  };

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Categories</h1>
          <p className="page-subtitle">Manage product categories — add, rename or delete</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg">
          <Tags size={13} />
          {categories.length} categories
        </div>
      </div>

      {/* Add category card */}
      <div className="card p-5 mb-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Add New Category</h3>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Beverages, Snacks, Dairy…"
            className="input flex-1"
            autoFocus
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="btn-primary"
          >
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Add
          </button>
        </form>
      </div>

      {/* Category list */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-slate-700">All Categories</h3>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 size={24} className="animate-spin text-blue-500 mx-auto" />
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Tags size={36} strokeWidth={1} className="mx-auto mb-3" />
            <p className="font-medium text-slate-500">No categories yet</p>
            <p className="text-sm mt-1">Add your first category above</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((cat, idx) => (
              <li key={cat.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/70 transition-colors group">
                {/* Index badge */}
                <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </span>

                {editId === cat.id ? (
                  /* Edit mode */
                  <>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleEdit(cat.id);
                        if (e.key === 'Escape') setEditId(null);
                      }}
                      className="input flex-1 py-1.5 text-sm"
                      autoFocus
                    />
                    <button
                      onClick={() => handleEdit(cat.id)}
                      disabled={saving}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Save"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  /* View mode */
                  <>
                    <span className="flex-1 text-sm font-medium text-slate-700">{cat.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(cat)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Rename"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id, cat.name)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
