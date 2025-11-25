// pages/EditSquadPage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Users, Loader2 } from "lucide-react";
import { getSquadById } from '@/services/squadService';
import { updateSquad } from '@/services/squadService';
import { Input, Textarea, Button } from '@/components/ui';

export default function EditSquadPage() {
  const { squadId } = useParams<{ squadId: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!squadId) return;
    let mounted = true;
    setLoading(true);
    getSquadById(squadId)
      .then((data) => {
        if (!mounted) return;
        setName(data?.name ?? "");
        setDescription(data?.description ?? "");
        setError("");
      })
      .catch((e: unknown) => {
        if (mounted && e instanceof Error) {
          setError(e.message ?? "Failed to load squad");
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [squadId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!squadId) return;
    setError("");
    setSaving(true);
    try {
      await updateSquad(squadId, { name, description });
      navigate(`/squads`);
    } catch (err: any) {
      setError(err?.message || "Failed to update squad");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        {/* Header Skeleton */}
        <header className="sticky top-0 z-100 bg-background-card backdrop-blur-[10px] border-b border-border">
          <div className="max-w-[1600px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between gap-6">
              <div className="w-20 h-8 bg-linear-to-r from-[rgba(255,255,255,0.05)] via-[rgba(255,255,255,0.1)] to-[rgba(255,255,255,0.05)] bg-size-[300%_100%] rounded animate-[shimmer_1.5s_infinite]" />
              <div className="flex-1 flex items-center gap-3">
                <div className="w-10 h-10 bg-linear-to-r from-[rgba(255,255,255,0.05)] via-[rgba(255,255,255,0.1)] to-[rgba(255,255,255,0.05)] bg-size-[300%_100%] rounded-xl animate-[shimmer_1.5s_infinite]" />
                <div className="w-32 h-6 bg-linear-to-r from-[rgba(255,255,255,0.05)] via-[rgba(255,255,255,0.1)] to-[rgba(255,255,255,0.05)] bg-size-[300%_100%] rounded animate-[shimmer_1.5s_infinite]" />
              </div>
            </div>
          </div>
        </header>

        {/* Loading Content */}
        <main className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="bg-background-elevated border border-border rounded-2xl p-5 shadow-[0_12px_40px_rgba(3,10,18,0.65)]">
            <div className="flex items-center justify-center py-12">
              <Loader2
                size={32}
                className="text-primary] animate-spin"
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-[100] bg-[var(--color-background-card)] backdrop-blur-[10px] border-b border-border">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-6">
            {/* Back Button */}
            <button
              className="flex items-center gap-2 text-text-secondary bg-transparent border-none font-medium cursor-pointer transition-all px-3 py-2 rounded-lg hover:text-primary-light hover:bg-[rgba(14,165,233,0.1)]"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={18} />
              <span className="hidden sm:inline">Back</span>
            </button>

            {/* Title */}
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[rgba(49,151,167,0.2)] to-[rgba(34,211,238,0.2)] flex items-center justify-center">
                <Users size={20} className="text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold m-0 bg-linear-to-r from-primary-dark via-primary to-accent bg-clip-text text-transparent">
                Edit Squad
              </h1>
            </div>

            {/* Spacer for alignment */}
            <div className="w-[100px] hidden sm:block" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-slate-900/50 border-2 border-cyan-500/20 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-6">
            Edit: {name || "Squad"}
          </h2>
          
          <form onSubmit={handleSave} className="space-y-6">
            <Input
              label="Squad Name"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
              placeholder="E.g. Junior Sharks"
              disabled={saving}
              required
            />

            <Textarea
              label="Description"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDescription(e.target.value)
              }
              placeholder="Short description for your squad"
              rows={4}
              disabled={saving}
              hint="Optional - Add a short description for your squad"
            />

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border-2 border-red-500/30 rounded-xl text-red-400">
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                loadingText="Saving..."
                icon={<Users size={20} />}
              >
                Save Changes
              </Button>
              
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(-1)}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-linear-to-br from-[rgba(49,151,167,0.04)] to-[rgba(139,92,246,0.02)] border border-border rounded-xl p-4">
          <p className="text-text-secondary text-sm m-0 leading-relaxed">
            💡 <strong>Tip:</strong> Changes will be saved immediately and
            reflected across all squad members.
          </p>
        </div>
      </main>
    </div>
  );
}
