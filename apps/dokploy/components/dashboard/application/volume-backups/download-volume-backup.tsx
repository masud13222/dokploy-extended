import copy from "copy-to-clipboard";
import debounce from "lodash/debounce";
import {
	CheckIcon,
	ChevronsUpDown,
	Copy,
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
	const [selectedDestinationId, setSelectedDestinationId] = useState("");
	const [selectedFile, setSelectedFile] = useState<string>("");
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);

	const { data: destinations = [] } = api.destination.all.useQuery();

	const debouncedSetSearch = debounce((value: string) => {
		setDebouncedSearch(value);
	}, 350);

	const handleSearchChange = (value: string) => {
		setSearch(value);
		debouncedSetSearch(value);
	};

	const { data: files = [], isPending: isLoadingFiles } =
		api.backup.listBackupFiles.useQuery(
			{
				destinationId: selectedDestinationId,
				search: debouncedSearch,
				serverId: serverId ?? "",
			},
			{
				enabled: isOpen && !!selectedDestinationId,
			},
		);

	const { mutateAsync: generateDownloadUrl } =
		api.volumeBackups.generateDownloadUrl.useMutation();

	const handleDownload = async () => {
		if (!selectedFile || !selectedDestinationId) return;
		setIsGenerating(true);
		try {
			const { url } = await generateDownloadUrl({
				volumeBackupId,
				filePath: selectedFile,
				destinationId: selectedDestinationId,
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

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (!open) {
			setSelectedDestinationId("");
			setSelectedFile("");
			setSearch("");
			setDebouncedSearch("");
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
						Select a destination and backup file to download locally
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4">
					{/* Destination selector */}
					<div className="flex flex-col gap-2">
						<label className="text-sm font-medium">Destination</label>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									className={cn(
										"w-full justify-between !bg-input",
										!selectedDestinationId && "text-muted-foreground",
									)}
								>
									{selectedDestinationId
										? destinations.find(
												(d) => d.destinationId === selectedDestinationId,
											)?.name
										: "Select Destination"}
									<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
								</Button>
							</PopoverTrigger>
							<PopoverContent className="p-0" align="start">
								<Command>
									<CommandInput
										placeholder="Search destinations..."
										className="h-9"
									/>
									<CommandEmpty>No destinations found.</CommandEmpty>
									<ScrollArea className="h-48">
										<CommandGroup>
											{destinations.map((destination) => (
												<CommandItem
													value={destination.destinationId}
													key={destination.destinationId}
													onSelect={() => {
														setSelectedDestinationId(destination.destinationId);
														setSelectedFile("");
														setSearch("");
														setDebouncedSearch("");
													}}
												>
													{destination.name}
													<CheckIcon
														className={cn(
															"ml-auto h-4 w-4",
															destination.destinationId === selectedDestinationId
																? "opacity-100"
																: "opacity-0",
														)}
													/>
												</CommandItem>
											))}
										</CommandGroup>
									</ScrollArea>
								</Command>
							</PopoverContent>
						</Popover>
					</div>

					{/* Backup file selector */}
					<div className="flex flex-col gap-2">
						<label className="text-sm font-medium flex items-center gap-2">
							Search Backup Files
							{selectedFile && (
								<span className="inline-flex items-center gap-1 border rounded px-1.5 py-0.5 text-[10px] font-mono max-w-[200px] truncate">
									{selectedFile.split("/").pop()}
									<Copy
										className="size-3 cursor-pointer shrink-0"
										onClick={(e) => {
											e.stopPropagation();
											copy(selectedFile);
											toast.success("Path copied to clipboard");
										}}
									/>
								</span>
							)}
						</label>
						<Popover modal>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									className={cn(
										"w-full justify-between !bg-input",
										!selectedFile && "text-muted-foreground",
									)}
									disabled={!selectedDestinationId}
								>
									<span className="truncate text-left flex-1 min-w-0">
										{selectedFile
											? selectedFile.split("/").pop() || selectedFile
											: selectedDestinationId
												? "Search and select a backup file"
												: "Select a destination first"}
									</span>
									<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
								</Button>
							</PopoverTrigger>
							<PopoverContent
								className="p-0 w-[min(460px,90vw)]"
								align="start"
							>
								<Command>
									<CommandInput
										placeholder="Search backup files..."
										value={search}
										onValueChange={handleSearchChange}
										className="h-9"
									/>
									{isLoadingFiles ? (
										<div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
											<Loader2 className="size-4 animate-spin" />
											Loading files...
										</div>
									) : files.length === 0 && search ? (
										<div className="py-6 text-center text-sm text-muted-foreground">
											No files found for "{search}"
										</div>
									) : files.length === 0 ? (
										<div className="py-6 text-center text-sm text-muted-foreground">
											No backup files available
										</div>
									) : (
										<ScrollArea className="h-64">
											<CommandGroup>
												{files.map((file) => (
													<CommandItem
														value={file.Path}
														key={file.Path}
														className="flex items-start gap-2"
														onSelect={() => {
															setSelectedFile(file.Path);
															if (file.IsDir) {
																setSearch(`${file.Path}/`);
																setDebouncedSearch(`${file.Path}/`);
															} else {
																setSearch(file.Path);
																setDebouncedSearch(file.Path);
															}
														}}
													>
														<div className="flex w-full min-w-0 flex-col gap-1">
															<div className="flex w-full items-center gap-2">
																<span
																	className="font-medium text-sm break-all leading-tight flex-1"
																	title={file.Path}
																>
																	{file.Path}
																</span>
																<CheckIcon
																	className={cn(
																		"h-4 w-4 shrink-0",
																		file.Path === selectedFile
																			? "opacity-100"
																			: "opacity-0",
																	)}
																/>
															</div>
															<div className="flex items-center gap-3 text-xs text-muted-foreground">
																<span>{formatBytes(file.Size)}</span>
																{file.IsDir && (
																	<span className="text-blue-500">Directory</span>
																)}
																{file.Hashes?.MD5 && (
																	<span className="truncate max-w-[120px]">MD5: {file.Hashes.MD5}</span>
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
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={handleDownload}
						disabled={!selectedFile || !selectedDestinationId || isGenerating}
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
