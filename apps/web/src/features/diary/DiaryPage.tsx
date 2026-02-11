import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { DiaryEntryForm } from "./DiaryEntryForm";
import { DiaryList } from "./DiaryList";
import { DiaryEntry } from "./api";

export function DiaryPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleNewEntry = () => {
    setEditingEntry(undefined);
    setShowForm(true);
  };

  const handleEdit = (entry: DiaryEntry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleSuccess = () => {
    setShowForm(false);
    setEditingEntry(undefined);
    setRefreshKey((k) => k + 1);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingEntry(undefined);
  };

  return (
    <div className="min-h-screen bg-muted/30 py-6 sm:py-8">
      <div className="container max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-2">
          <h1 className="text-xl sm:text-2xl font-bold truncate">Sleep Diary</h1>
          {!showForm && (
            <Button onClick={handleNewEntry} className="min-h-[44px] shrink-0">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Log Sleep</span>
              <span className="sm:hidden">Log</span>
            </Button>
          )}
        </div>

        {/* Content */}
        {showForm ? (
          <DiaryEntryForm
            existingEntry={editingEntry}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        ) : (
          <DiaryList onEdit={handleEdit} refreshTrigger={refreshKey} />
        )}
      </div>
    </div>
  );
}
