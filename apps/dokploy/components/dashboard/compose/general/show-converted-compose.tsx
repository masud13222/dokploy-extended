import {
	History,
	Loader2,
	Pencil,
	Puzzle,
	RefreshCw,
	Rocket,
	Save,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
import { CodeEditor } from "@/components/shared/code-editor";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/utils/api";

interface Props {
	composeId: string;
}

export const ShowConvertedCompose = ({ composeId }: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editedContent, setEditedContent] = useState<string>("");
	// Keeps the last auto-generated snapshot so user can restore it
	const originalSnapshotRef = useRef<string>("");

	const {
		data: compose,
		error,
		isError,
		refetch,
	} = api.compose.getConvertedCompose.useQuery(
		{ composeId },
		{ retry: false },
	);

	const { mutateAsync: fetchSource, isPending: isFetching } =
		api.compose.fetchSourceType.useMutation();
	const { mutateAsync: redeploy, isPending: isDeploying } =
		api.compose.redeploy.useMutation();
	const { mutateAsync: updateCompose, isPending: isSaving } =
		api.compose.update.useMutation();

	// On open: fetch source and regenerate
	useEffect(() => {
		if (isOpen) {
			fetchSource({ composeId })
				.then(() => refetch())
				.catch(() => {});
		}
	}, [isOpen]);

	// When fresh compose arrives, update snapshot & editor baseline
	useEffect(() => {
		if (compose) {
			originalSnapshotRef.current = compose;
			setEditedContent(compose);
		}
	}, [compose]);

	const handleEdit = () => {
		setEditedContent(compose || "");
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		setEditedContent(compose || "");
		setIsEditing(false);
	};

	/** Save edited content to DB (persists across reloads) */
	const handleSave = async () => {
		try {
			await updateCompose({ composeId, composeFile: editedContent });
			toast.success("Compose file saved");
			setIsEditing(false);
			refetch();
		} catch (err) {
			toast.error("Failed to save", {
				description: err instanceof Error ? err.message : undefined,
			});
		}
	};

	/** Re-fetch source, regenerate compose, clear any manual edits */
	const handleRestoreOriginal = async () => {
		try {
			// Save empty string → next getConvertedCompose uses raw source
			await updateCompose({ composeId, composeFile: "" });
			await fetchSource({ composeId });
			await refetch();
			setIsEditing(false);
			toast.success("Compose restored to auto-generated version");
		} catch (err) {
			toast.error("Failed to restore", {
				description: err instanceof Error ? err.message : undefined,
			});
		}
	};

	const handleDeploy = async () => {
		try {
			if (isEditing) {
				await updateCompose({ composeId, composeFile: editedContent });
			}
			await redeploy({ composeId });
			toast.success("Deployment started");
			setIsEditing(false);
			setIsOpen(false);
		} catch (err) {
			toast.error("Failed to deploy", {
				description: err instanceof Error ? err.message : undefined,
			});
		}
	};

	const isEmpty = !compose || compose.length <= 5;

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				setIsOpen(open);
				if (!open) setIsEditing(false);
			}}
		>
			<DialogTrigger asChild>
				<Button className="max-lg:w-full" variant="outline">
					<Puzzle className="h-4 w-4" />
					Preview Compose
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col gap-3">
				<DialogHeader>
					<DialogTitle>Converted Compose</DialogTitle>
					<DialogDescription>
						{isEditing
							? "Edit the compose file. Save to persist changes, or Save & Deploy to deploy immediately. Use Restore to reset to the auto-generated version."
							: "Auto-generated compose with domain configuration injected. Edit to customise before deploying."}
					</DialogDescription>
				</DialogHeader>

				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				{isFetching ? (
					<div className="flex items-center justify-center min-h-[25rem] border rounded-md">
						<Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
					</div>
				) : isEmpty ? (
					<div className="border rounded-md flex flex-col items-center justify-center min-h-[25rem]">
						<Puzzle className="h-8 w-8 text-muted-foreground mb-2" />
						<span className="text-muted-foreground text-sm">
							No compose data available. Add at least one domain first.
						</span>
					</div>
				) : (
					<>
						{/* Toolbar */}
						<div className="flex items-center justify-between gap-2 flex-wrap">
							{/* Left: status badge */}
							<span className="text-xs text-muted-foreground px-2 py-1 rounded-md border bg-muted/40">
								{isEditing ? "✏️ Editing" : "👁️ Preview"}
							</span>

							{/* Right: action buttons */}
							<div className="flex gap-2 flex-wrap">
								{isEditing ? (
									<>
										<Button
											variant="ghost"
											size="sm"
											onClick={handleCancelEdit}
											disabled={isSaving || isDeploying}
										>
											<X className="mr-1.5 h-3.5 w-3.5" />
											Cancel
										</Button>
										<Button
											variant="outline"
											size="sm"
											isLoading={isSaving}
											disabled={isDeploying}
											onClick={handleSave}
										>
											<Save className="mr-1.5 h-3.5 w-3.5" />
											Save
										</Button>
										<Button
											size="sm"
											isLoading={isDeploying}
											disabled={isSaving}
											onClick={handleDeploy}
										>
											<Rocket className="mr-1.5 h-3.5 w-3.5" />
											Save & Deploy
										</Button>
									</>
								) : (
									<>
										<Button
											variant="ghost"
											size="sm"
											isLoading={isFetching || isSaving}
											disabled={isDeploying}
											onClick={handleRestoreOriginal}
											title="Regenerate from source and discard any saved edits"
										>
											<History className="mr-1.5 h-3.5 w-3.5" />
											Restore Original
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={handleEdit}
											disabled={isDeploying}
										>
											<Pencil className="mr-1.5 h-3.5 w-3.5" />
											Edit
										</Button>
										<Button
											size="sm"
											isLoading={isDeploying}
											onClick={handleDeploy}
										>
											<Rocket className="mr-1.5 h-3.5 w-3.5" />
											Deploy
										</Button>
									</>
								)}
							</div>
						</div>

						<div className="flex-1 overflow-auto rounded-md border">
							<CodeEditor
								value={isEditing ? editedContent : compose || ""}
								language="yaml"
								readOnly={!isEditing}
								height="50rem"
								onChange={
									isEditing
										? (val) => setEditedContent(val || "")
										: undefined
								}
							/>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
};
