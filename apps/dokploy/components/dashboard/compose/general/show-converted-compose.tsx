import { Loader2, Pencil, Puzzle, RefreshCw, Rocket, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
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

	const {
		data: compose,
		error,
		isError,
		refetch,
	} = api.compose.getConvertedCompose.useQuery(
		{ composeId },
		{
			retry: false,
		},
	);

	const { mutateAsync, isPending } = api.compose.fetchSourceType.useMutation();
	const { mutateAsync: redeploy, isPending: isDeploying } =
		api.compose.redeploy.useMutation();
	const { mutateAsync: updateCompose, isPending: isSaving } =
		api.compose.update.useMutation();

	useEffect(() => {
		if (isOpen) {
			mutateAsync({ composeId })
				.then(() => {
					refetch();
				})
				.catch(() => {});
		}
	}, [isOpen]);

	useEffect(() => {
		if (compose) {
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

	const handleSave = async () => {
		try {
			await updateCompose({ composeId, composeFile: editedContent });
			toast.success("Compose file saved successfully");
			setIsEditing(false);
			refetch();
		} catch (err) {
			toast.error("Failed to save compose file", {
				description: err instanceof Error ? err.message : undefined,
			});
		}
	};

	const handleDeployEdited = async () => {
		try {
			if (isEditing) {
				await updateCompose({ composeId, composeFile: editedContent });
			}
			await redeploy({ composeId });
			toast.success("Deployment started successfully");
			setIsEditing(false);
			setIsOpen(false);
		} catch (err) {
			toast.error("Failed to deploy", {
				description: err instanceof Error ? err.message : undefined,
			});
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setIsEditing(false); }}>
			<DialogTrigger asChild>
				<Button className="max-lg:w-full" variant="outline">
					<Puzzle className="h-4 w-4" />
					Preview Compose
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>Converted Compose</DialogTitle>
					<DialogDescription>
						{isEditing
							? "Edit the compose file below, then save or deploy directly."
							: "Preview your docker-compose file with added domains. Note: At least one domain must be specified for this conversion to take effect."}
					</DialogDescription>
				</DialogHeader>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				{!isEditing && (
					<AlertBlock type="info">
						Preview your docker-compose file with added domains. Note: At least
						one domain must be specified for this conversion to take effect.
					</AlertBlock>
				)}

				{isPending ? (
					<div className="flex flex-row items-center justify-center min-h-[25rem] border p-4 rounded-md">
						<Loader2 className="h-8 w-8 text-muted-foreground mb-2 animate-spin" />
					</div>
				) : compose?.length === 5 ? (
					<div className="border p-4 rounded-md flex flex-col items-center justify-center min-h-[25rem]">
						<Puzzle className="h-8 w-8 text-muted-foreground mb-2" />
						<span className="text-muted-foreground">
							No converted compose data available.
						</span>
					</div>
				) : (
					<>
						<div className="flex flex-row gap-2 justify-end my-2 flex-wrap">
							{isEditing ? (
								<>
									<Button
										variant="outline"
										onClick={handleCancelEdit}
										disabled={isSaving || isDeploying}
									>
										<X className="mr-2 h-4 w-4" />
										Cancel
									</Button>
									<Button
										variant="secondary"
										isLoading={isSaving}
										disabled={isDeploying}
										onClick={handleSave}
									>
										<Save className="mr-2 h-4 w-4" />
										Save
									</Button>
									<Button
										variant="default"
										isLoading={isDeploying}
										disabled={isSaving}
										onClick={handleDeployEdited}
									>
										<Rocket className="mr-2 h-4 w-4" />
										Save & Deploy
									</Button>
								</>
							) : (
								<>
									<Button
										variant="secondary"
										isLoading={isPending}
										onClick={() => {
											mutateAsync({ composeId })
												.then(() => {
													refetch();
													toast.success("Fetched source type");
												})
												.catch((err) => {
													toast.error("Error fetching source type", {
														description: err.message,
													});
												});
										}}
									>
										<RefreshCw className="mr-2 h-4 w-4" />
										Refresh
									</Button>
									<Button
										variant="outline"
										onClick={handleEdit}
									>
										<Pencil className="mr-2 h-4 w-4" />
										Edit
									</Button>
									<Button
										variant="default"
										isLoading={isDeploying}
										onClick={handleDeployEdited}
									>
										<Rocket className="mr-2 h-4 w-4" />
										Deploy
									</Button>
								</>
							)}
						</div>

						<div className="flex-1 overflow-auto">
							<CodeEditor
								value={isEditing ? editedContent : (compose || "")}
								language="yaml"
								readOnly={!isEditing}
								height="50rem"
								onChange={isEditing ? (val) => setEditedContent(val || "") : undefined}
							/>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
};
