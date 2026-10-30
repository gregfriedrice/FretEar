import React, { useState } from 'react';
import {
  Bookmark,
  Play,
  Trash2,
  Download,
  Upload,
  Plus,
  Clock,
  Music,
  Edit2,
  Check,
  X,
  FileJson,
} from 'lucide-react';
import { PhraseSection, LoopRegion } from '../types';
import { formatTimecode } from '../utils/formatters';

interface SectionsManagerProps {
  sections: PhraseSection[];
  onSelectSection: (section: PhraseSection) => void;
  onDeleteSection: (id: string) => void;
  onSaveNewSection: (name: string, notes?: string, color?: string) => void;
  loopRegion: LoopRegion | null;
  trackTitle: string;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  onImportSections: (sections: PhraseSection[]) => void;
}

const SECTION_COLORS = [
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#f97316', // orange
];

export const SectionsManager: React.FC<SectionsManagerProps> = ({
  sections,
  onSelectSection,
  onDeleteSection,
  onSaveNewSection,
  loopRegion,
  trackTitle,
  isModalOpen,
  setIsModalOpen,
  onImportSections,
}) => {
  const [phraseName, setPhraseName] = useState('');
  const [phraseNotes, setPhraseNotes] = useState('');
  const [selectedColor, setSelectedColor] = useState(SECTION_COLORS[0]);

  // Editing inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleOpenModal = () => {
    setPhraseName(`Lick ${sections.length + 1}`);
    setPhraseNotes('');
    setIsModalOpen(true);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phraseName.trim()) return;
    onSaveNewSection(phraseName.trim(), phraseNotes.trim(), selectedColor);
    setIsModalOpen(false);
  };

  // Export sections as JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sections, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${trackTitle.replace(/[^a-z0-9]/gi, '_')}_phrases.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import sections from JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          onImportSections(parsed);
        }
      } catch (err) {
        alert('Invalid phrase bookmark JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-zinc-100 tracking-tight">
            Saved Phrases & Ear-Training Bookmarks
          </h3>
          <span className="font-mono text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
            {sections.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Export JSON */}
          {sections.length > 0 && (
            <button
              type="button"
              onClick={handleExportJSON}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-zinc-400 hover:text-zinc-200 bg-zinc-950 border border-zinc-800 rounded hover:bg-zinc-800 transition cursor-pointer"
              title="Export phrase markers to JSON"
            >
              <Download className="w-3 h-3" />
              <span>Export</span>
            </button>
          )}

          {/* Import JSON */}
          <label className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-zinc-400 hover:text-zinc-200 bg-zinc-950 border border-zinc-800 rounded hover:bg-zinc-800 transition cursor-pointer">
            <Upload className="w-3 h-3" />
            <span>Import</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </label>

          {/* Add bookmark button */}
          <button
            type="button"
            onClick={handleOpenModal}
            disabled={!loopRegion}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 text-xs font-semibold rounded transition cursor-pointer disabled:cursor-not-allowed shadow"
            title={loopRegion ? 'Save current A/B selection as a phrase bookmark' : 'Set Point A and Point B first'}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Bookmark Phrase</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {sections.length === 0 ? (
        <div className="py-8 text-center border border-zinc-800/80 rounded-lg bg-zinc-950/40 p-4">
          <p className="text-sm font-medium text-zinc-300">No phrases bookmarked yet</p>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            Press <strong className="text-amber-400 font-bold">[</strong> and <strong className="text-amber-400 font-bold">]</strong> on your keyboard to set a loop region, then click "Bookmark Phrase" (or press <strong className="text-amber-400 font-bold">S</strong>).
          </p>
        </div>
      ) : (
        /* Grid of Saved Sections */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {sections.map((section) => {
            const duration = (section.end - section.start).toFixed(2);
            return (
              <div
                key={section.id}
                className="group relative bg-zinc-950/90 hover:bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-lg p-3 transition flex flex-col justify-between"
                style={{ borderLeftWidth: '4px', borderLeftColor: section.color }}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-xs text-zinc-100 group-hover:text-amber-300 transition truncate">
                      {section.name}
                    </h4>
                    <span className="font-mono text-[11px] text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 shrink-0">
                      Δ {duration}s
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 mt-1.5">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    <span>{formatTimecode(section.start)}</span>
                    <span className="text-zinc-600">→</span>
                    <span>{formatTimecode(section.end)}</span>
                  </div>

                  {section.notes && (
                    <p className="text-[11px] text-zinc-400 mt-1.5 font-mono line-clamp-2 leading-relaxed bg-zinc-900/40 p-1 rounded">
                      {section.notes}
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onSelectSection(section)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs font-semibold transition cursor-pointer"
                    title="Load phrase into A/B loop and seek to start"
                  >
                    <Play className="w-3 h-3 fill-amber-400" />
                    <span>Recall & Loop</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteSection(section.id)}
                    className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition cursor-pointer"
                    title="Delete saved phrase"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Save Phrase Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-base text-zinc-100">
                  Bookmark Current Phrase
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loopRegion && (
              <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-400 flex items-center justify-between">
                <span>Phrase Boundaries:</span>
                <span className="text-amber-400 font-bold">
                  {formatTimecode(loopRegion.start)} → {formatTimecode(loopRegion.end)} ({(loopRegion.end - loopRegion.start).toFixed(2)}s)
                </span>
              </div>
            )}

            <form onSubmit={handleSaveSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Phrase Label
                </label>
                <input
                  type="text"
                  value={phraseName}
                  onChange={(e) => setPhraseName(e.target.value)}
                  placeholder="e.g. Intro Riff, Verse Bend, Fast Pentatonic Run"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Fretboard / Guitar Notes (Optional)
                </label>
                <input
                  type="text"
                  value={phraseNotes}
                  onChange={(e) => setPhraseNotes(e.target.value)}
                  placeholder="e.g., 7th fret G string bend, pick with alternate stroke"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Phrase Color Tag
                </label>
                <div className="flex items-center gap-2">
                  {SECTION_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition cursor-pointer flex items-center justify-center ${
                        selectedColor === color
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {selectedColor === color && <Check className="w-3.5 h-3.5 text-black" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!phraseName.trim()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-lg transition cursor-pointer disabled:opacity-50 shadow"
                >
                  Save Phrase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
