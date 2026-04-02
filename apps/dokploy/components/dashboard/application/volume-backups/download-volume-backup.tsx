import {
	CheckIcon,
	ChevronsUpDown,
	Download,
	ExternalLink,
	Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
} from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { api } from "@/utils/api";
import { formatBytes } from "../../database/backups/restore-backup";

interface Props {
	volumeBackupId: string;
	serverId?: string;
}

export const DownloadVolumeBackup = ({ volumeBackupId, serverId }: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const [selectedFile, setSelectedFile] = useState<string>("");
	const [isGenerating, setIsGenerating] = useState(false);

	const { data: files = [], isLoading: isLoadingFiles } =
		api.volumeBackups.listFiles.useQuery(
			{ volumeBackupId, serverId },
			{ enabled: isOpen },
		);

	const { mutateAsync: generateDownloadUrl } =
		api.volumeBackups.generateDownloadUrl.useMutation();

	const handleDownload = async () => {
		if (!selectedFile) return;
		setIsGenerating(true);
		try {
			const { url } = await generateDownloadUrl({
				volumeBackupId,
				filePath: selectedFile,
				serverId,
			});
			window.open(url, "_blank");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to generate download URL",
			);
		} finally {
			setIsGenerating(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon">
					<Download className="size-4 transition-colors" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Download className="size-4" />
						Download Volume Backup
					</DialogTitle>
					<DialogDescription>
						Select a backup file to download locally
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4">
					<div className="flex flex-col gap-2">
						<label className="text-sm font-medium">Backup File</label>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									className={cn(
										"w-full justify-between !bg-input",
										!selectedFile && "text-muted-foreground",
									)}
								>
									<span className="truncate text-left flex-1">
										{selectedFile
											? selectedFile.split("/").pop()
											: "Select a backup file"}
									</span>
									<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
								</Button>
							</PopoverTrigger>
							<PopoverContent className="p-0 w-[460px]" align="start">
								<Command>
									<CommandInput
										placeholder="Search backup files..."
										className="h-9"
									/>
									{isLoadingFiles ? (
										<div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
											<Loader2 className="size-4 animate-spin" />
											Loading backup files...
										</div>
									) : files.length === 0 ? (
										<CommandEmpty>No backup files found</CommandEmpty>
									) : (
										<ScrollArea className="h-64">
											<CommandGroup>
												{files.map((file) => (
													<CommandItem
														value={file.FullPath}
														key={file.FullPath}
														onSelect={() => setSelectedFile(file.FullPath)}
													>
														<div className="flex w-full flex-col gap-1">
															<div className="flex w-full justify-between items-center">
																<span className="font-medium text-sm truncate max-w-[300px]">
																	{file.Name || file.Path}
																</span>
																<CheckIcon
																	className={cn(
																		"ml-auto h-4 w-4 shrink-0",
																		file.FullPath === selectedFile
																			? "opacity-100"
																			: "opacity-0",
																	)}
																/>
															</div>
															<div className="flex items-center gap-3 text-xs text-muted-foreground">
																<span>{formatBytes(file.Size)}</span>
																{file.ModTime && (
																	<span>
																		{new Date(file.ModTime).toLocaleString()}
																	</span>
																)}
															</div>
														</div>
													</CommandItem>
												))}
											</CommandGroup>
										</ScrollArea>
									)}
								</Command>
							</PopoverContent>
						</Popover>
					</div>

					{selectedFile && (
						<p className="text-xs text-muted-foreground break-all">
							Selected: {selectedFile}
						</p>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => setIsOpen(false)}
					>
						Cancel
					</Button>
					<Button
						onClick={handleDownload}
						disabled={!selectedFile || isGenerating}
						isLoading={isGenerating}
					>
						<ExternalLink className="mr-2 size-4" />
						Generate Download Link
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
