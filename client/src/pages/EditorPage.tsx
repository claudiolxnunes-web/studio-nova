import { useEffect, useState } from "react";
import { Link } from "wouter";
import ExportDialog from "@/components/studio/ExportDialog";
import Inspector from "@/components/studio/Inspector";
import SceneRail from "@/components/studio/SceneRail";
import Stage from "@/components/studio/Stage";
import Timeline from "@/components/studio/Timeline";
import TopBar from "@/components/studio/TopBar";
import { EditorProvider, useEditor } from "@/store/editor";
import { requestPersistentStorage } from "@/lib/storage";

export default function EditorPage({ params }: { params: { id: string } }) {
  const api = useEditor(params.id);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  if (api.loading) {
    return (
      <div className="studio-shell grid min-h-screen place-items-center">
        <p className="text-[12.5px] text-muted-foreground">Abrindo sua aula…</p>
      </div>
    );
  }

  if (!api.project) {
    return (
      <div className="studio-shell grid min-h-screen place-items-center px-4">
        <div className="panel max-w-sm p-6 text-center">
          <p className="wordmark text-[15px]">Aula não encontrada</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
            Ela pode ter sido excluída ou foi criada em outro navegador. Volte para a lista e crie uma nova.
          </p>
          <Link href="/" className="btn-primary mt-4 inline-flex">
            Ver minhas aulas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <EditorProvider value={api}>
      <div className="studio-shell flex h-[100dvh] flex-col overflow-hidden">
        <TopBar onExport={() => setExportOpen(true)} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <SceneRail />
          <div className="flex min-h-[34vh] min-w-0 flex-1 flex-col overflow-hidden lg:min-h-0">
            <Stage />
            <Timeline />
          </div>
          <Inspector />
        </div>
        <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      </div>
    </EditorProvider>
  );
}
