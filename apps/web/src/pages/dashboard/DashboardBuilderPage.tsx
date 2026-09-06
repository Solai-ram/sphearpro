import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, GripVertical, Loader2, Save } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { dashboardApi, type DashboardLayoutItem } from '../../services/dashboard';

function SortableWidget({
  item,
  onToggle,
}: {
  item: DashboardLayoutItem;
  onToggle: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.widgetId });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card p-3 flex items-center gap-3 ${item.isVisible ? '' : 'opacity-50'}`}
    >
      <button type="button" className="text-gray-400 cursor-grab" {...attributes} {...listeners}>
        <GripVertical className="w-5 h-5" />
      </button>
      <div className="flex-1">
        <p className="font-medium">{item.title}</p>
        <p className="text-xs text-gray-500">{item.category} · {item.key}</p>
      </div>
      <label className="text-sm flex items-center gap-2">
        <input type="checkbox" checked={item.isVisible} onChange={() => onToggle(item.widgetId)} />
        Visible
      </label>
    </div>
  );
}

export function DashboardBuilderPage() {
  const [items, setItems] = useState<DashboardLayoutItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setItems(await dashboardApi.getLayout());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load layout');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((current) => {
      const oldIndex = current.findIndex((item) => item.widgetId === active.id);
      const newIndex = current.findIndex((item) => item.widgetId === over.id);
      return arrayMove(current, oldIndex, newIndex);
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload = items.map((item, index) => ({
        widgetId: item.widgetId,
        positionX: index % 4,
        positionY: Math.floor(index / 4),
        isVisible: item.isVisible,
      }));
      const next = await dashboardApi.saveLayout(payload) as DashboardLayoutItem[];
      if (Array.isArray(next)) setItems(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Dashboard builder</h1>
        <p className="text-gray-500">Drag to reorder widgets and hide ones you do not need. This layout is saved for your user.</p>
      </div>
      <Link to="/dashboard" className="text-blue-700 text-sm">Back to dashboard</Link>
      {error && <div className="p-4 rounded-lg bg-red-50 text-red-700 flex gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}
      {saved && <div className="p-4 rounded-lg bg-green-50 text-green-700">Layout saved</div>}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((item) => item.widgetId)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((item) => (
                <SortableWidget
                  key={item.widgetId}
                  item={item}
                  onToggle={(id) => setItems((current) => current.map((row) => row.widgetId === id ? { ...row, isVisible: !row.isVisible } : row))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <button className="btn-primary" disabled={saving} onClick={save}>
        <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving…' : 'Save layout'}
      </button>
    </div>
  );
}
