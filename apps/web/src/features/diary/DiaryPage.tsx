import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus } from "lucide-react";
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
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Dashboard
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Sleep Diary</h1>
          </div>
          {!showForm && (
            <Button onClick={handleNewEntry}>
              <Plus className="h-4 w-4 mr-2" />
              Log Sleep
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
