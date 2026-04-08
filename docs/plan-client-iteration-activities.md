# Plan: Activity Expansion in Client View

## Context
The client page (`/client`) shows iteration cards with activity counts (done / in progress / to do), but there's no way to see _which_ activities those are. The goal is to let users expand each iteration card inline to reveal a mini Kanban with the actual activities, without leaving the overview page.

## Approach: Expandable card (inline Kanban)

Each iteration card gets a toggle button ("Ver atividades" / "Ocultar"). When expanded, it fetches `GET /api/v1/iterations/{id}/activities` and renders a 3-column Kanban (A Fazer · Em Progresso · Concluído) directly below the progress bar row.

This keeps the overview context intact and avoids a full-page navigation for a quick activity scan.

---

## File to modify

### `frontend/src/app/client/page.tsx`

This is the **only file that needs to change**.

### Step 1 — Add imports

```tsx
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
```

### Step 2 — Add `IterationActivities` child component (same file, outside `ClientPage`)

```tsx
function IterationActivities({ id }: { id: number }) {
  const { data: activities, loading } = useApi(() => api.iterationActivities(id), [id]);

  if (loading) return <p className="text-xs text-gray-400 py-3 text-center">Carregando atividades...</p>;

  const groups: Record<string, any[]> = { TODO: [], IN_PROGRESS: [], DONE: [] };
  (activities || []).forEach((a: any) => {
    if (["COMPLETED"].includes(a.status)) groups.DONE.push(a);
    else if (["ONGOING", "IN_PROGRESS"].includes(a.status)) groups.IN_PROGRESS.push(a);
    else groups.TODO.push(a);
  });

  const columnStyle = {
    TODO:        { header: "text-blue-600",   cardBorder: "border-l-2 border-blue-300" },
    IN_PROGRESS: { header: "text-orange-600", cardBorder: "border-l-2 border-orange-300" },
    DONE:        { header: "text-green-600",  cardBorder: "border-l-2 border-green-300" },
  };
  const columnLabel = { TODO: "A Fazer", IN_PROGRESS: "Em Progresso", DONE: "Concluído" };

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-3">
      {(["TODO", "IN_PROGRESS", "DONE"] as const).map((group) => (
        <div key={group}>
          <p className={`text-xs font-semibold mb-2 ${columnStyle[group].header}`}>
            {columnLabel[group]}{" "}
            <span className="text-gray-400 font-normal">({groups[group].length})</span>
          </p>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {groups[group].map((a: any) => (
              <div key={a.id} className={`p-2 bg-gray-50 rounded text-xs ${columnStyle[group].cardBorder}`}>
                <p className="font-medium text-gray-800 leading-snug">{a.activity_title}</p>
                <div className="flex justify-between items-center mt-0.5 text-gray-400">
                  <span>{a.member_name || "—"}{a.domain ? ` · ${a.domain}` : ""}</span>
                  <span className="font-mono">{a.activity_total_hours ? `${Number(a.activity_total_hours).toFixed(1)}h` : "—"}</span>
                </div>
              </div>
            ))}
            {groups[group].length === 0 && (
              <p className="text-gray-300 text-xs text-center py-2">Vazio</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Step 3 — Add state inside `ClientPage`

After `const { data, loading, error } = useApi(...)`, add:

```tsx
const [expandedId, setExpandedId] = useState<number | null>(null);
```

### Step 4 — Add toggle button and conditional panel inside each iteration card

At the bottom of the iteration card (after the activity counts `div`), add:

```tsx
{/* Toggle button */}
<button
  onClick={() => setExpandedId(expandedId === iter.iteration_id ? null : iter.iteration_id)}
  className="mt-3 flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
>
  {expandedId === iter.iteration_id ? (
    <><ChevronUp size={13} /> Ocultar atividades</>
  ) : (
    <><ChevronDown size={13} /> Ver atividades</>
  )}
</button>

{/* Expandable Kanban */}
{expandedId === iter.iteration_id && (
  <IterationActivities id={iter.iteration_id} />
)}
```

---

## After the change

Rebuild the containers:

```bash
docker-compose up -d --build
```

## Verification

1. Navigate to `http://localhost:8080/client`
2. Click "Ver atividades" on any iteration card → panel expands with 3 Kanban columns
3. Click "Ocultar atividades" → collapses
4. Only one card is expanded at a time (clicking a second card collapses the first)
5. Loading state shows while fetching activities
