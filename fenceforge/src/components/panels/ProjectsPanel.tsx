import { useState, useRef } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import type { CanvasSnapshot } from '../../store/canvasStore';
import { useHistory } from '../../hooks/useHistory';

const STORAGE_KEY = 'ff-projects';

interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  snapshot: CanvasSnapshot;
}

function loadProjects(): Project[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}

function saveProjects(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function fmt(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ProjectsPanel() {
  const getSnapshot   = useCanvasStore(s => s.getSnapshot);
  const loadSnapshot  = useCanvasStore(s => s.loadSnapshot);
  const { saveHistory } = useHistory();

  const [projects, setProjects] = useState<Project[]>(loadProjects);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editName,  setEditName]    = useState('');
  const [newName,   setNewName]     = useState('');
  const [confirmId, setConfirmId]   = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  function persist(next: Project[]) {
    setProjects(next);
    saveProjects(next);
  }

  function handleSave() {
    const name = newName.trim() || `Project ${projects.length + 1}`;
    const now  = Date.now();
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
      snapshot: getSnapshot(),
    };
    persist([project, ...projects]);
    setNewName('');
  }

  function handleLoad(p: Project) {
    saveHistory();
    loadSnapshot(p.snapshot);
  }

  function handleOverwrite(p: Project) {
    persist(projects.map(x => x.id === p.id
      ? { ...x, snapshot: getSnapshot(), updatedAt: Date.now() }
      : x
    ));
  }

  function handleRename(p: Project) {
    setEditingId(p.id);
    setEditName(p.name);
  }

  function commitRename(id: string) {
    const name = editName.trim();
    if (name) persist(projects.map(x => x.id === id ? { ...x, name } : x));
    setEditingId(null);
  }

  function handleDelete(id: string) {
    persist(projects.filter(x => x.id !== id));
    setConfirmId(null);
  }

  return (
    <div className="p-2 flex flex-col gap-2 text-[var(--c-text1)]">
      {/* Save new project */}
      <div className="flex flex-col gap-1">
        <input
          ref={newInputRef}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="Project name…"
          className="w-full text-xs bg-[var(--c-bg3)] border border-[var(--c-border1)] rounded px-2 py-1 text-[var(--c-text1)] placeholder:text-[var(--c-text4)] focus:outline-none focus:border-[var(--c-accent)]"
        />
        <button
          onClick={handleSave}
          className="w-full py-1 text-xs rounded bg-[var(--c-a-glow)] border border-[var(--c-a-ring)] text-[var(--c-accent)] hover:bg-[var(--c-a-ring)] transition-colors"
          title="Save current canvas as new project"
        >
          + Save Project
        </button>
      </div>

      {projects.length === 0 && (
        <p className="text-xs text-[var(--c-text4)] mt-2">No saved projects yet.</p>
      )}

      {/* Project list */}
      <div className="flex flex-col gap-1 mt-1">
        {projects.map(p => (
          <div
            key={p.id}
            className="rounded border border-[var(--c-border1)] bg-[var(--c-bg3)] p-2 flex flex-col gap-1"
          >
            {/* Name row */}
            {editingId === p.id ? (
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={() => commitRename(p.id)}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(p.id); if (e.key === 'Escape') setEditingId(null); }}
                className="text-xs bg-[var(--c-bg2)] border border-[var(--c-accent)] rounded px-1.5 py-0.5 text-[var(--c-text1)] focus:outline-none w-full"
              />
            ) : (
              <div className="flex items-center justify-between gap-1">
                <span
                  className="text-xs font-semibold text-[var(--c-text1)] truncate cursor-pointer hover:text-[var(--c-accent)] transition-colors"
                  onClick={() => handleRename(p)}
                  title="Click to rename"
                >
                  {p.name}
                </span>
                {confirmId === p.id ? (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleDelete(p.id)} className="text-[10px] text-red-400 hover:text-red-300 px-1">Delete</button>
                    <button onClick={() => setConfirmId(null)} className="text-[10px] text-[var(--c-text3)] hover:text-[var(--c-text2)] px-1">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(p.id)}
                    className="text-[10px] text-[var(--c-text4)] hover:text-red-400 transition-colors shrink-0 px-1"
                    title="Delete project"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Date */}
            <p className="text-[10px] text-[var(--c-text4)]">Saved {fmt(p.updatedAt)}</p>

            {/* Actions */}
            <div className="flex gap-1 mt-0.5">
              <button
                onClick={() => handleLoad(p)}
                className="flex-1 text-[10px] py-0.5 rounded bg-[var(--c-a-glow)] border border-[var(--c-a-ring)] text-[var(--c-accent)] hover:bg-[var(--c-a-ring)] transition-colors"
              >
                Load
              </button>
              <button
                onClick={() => handleOverwrite(p)}
                className="flex-1 text-[10px] py-0.5 rounded bg-[var(--c-bg4)] border border-[var(--c-border2)] text-[var(--c-text2)] hover:text-[var(--c-text1)] transition-colors"
                title="Overwrite with current canvas"
              >
                Update
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
