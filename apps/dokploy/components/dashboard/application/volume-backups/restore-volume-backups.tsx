import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import copy from "copy-to-clipboard";
import debounce from "lodash/debounce";
import { CheckIcon, ChevronsUpDown, Copy, RotateCcw, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AlertBlock } from "@/components/shared/alert-block";
import { DrawerLogs } from "@/components/shared/drawer-logs";
import { Badge } from "@/components/ui/badge";
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
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { api } from "@/utils/api";
import { formatBytes } from "../../database/backups/restore-backup";
import { type LogLine, parseLogs } from "../../docker/logs/utils";

interface Props {
	id: string;
	type: "application" | "compose";
	serverId?: string;
}

const RestoreBackupSchema = z.object({
	destinationId: z.string().min(1, {
		message: "Destination is required",
	}),
	backupFile: z.string().min(1, {
		message: "Backup file is required",
	}),
	volumeName: z.string().min(1, {
		message: "Volume name is required",
	}),
});

export const RestoreVolumeBackups = ({ id, type, serverId }: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

	// Local upload state
	const [localVolumeName, setLocalVolumeName] = useState("");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
	const [uploadError, setUploadError] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const xhrRef = useRef<XMLHttpRequest | null>(null);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			if (!file.name.endsWith(".tar")) {
				toast.error("Only .tar files are supported");
				return;
			}
			setSelectedFile(file);
			setUploadStatus("idle");
			setUploadError("");
			setUploadProgress(0);
		}
	};

	const handleUploadCancel = () => {
		if (xhrRef.current) {
			xhrRef.current.abort();
			xhrRef.current = null;
		}
		setIsUploading(false);
		setUploadStatus("idle");
		setUploadProgress(0);
		setSelectedFile(null);
		setUploadError("");
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const handleUpload = () => {
		if (!selectedFile) { toast.error("Please select a .tar file"); return; }
		if (!localVolumeName.trim()) { toast.error("Please enter the volume name"); return; }

		setIsUploading(true);
		setUploadStatus("uploading");
		setUploadProgress(0);
		setUploadError("");

		const xhr = new XMLHttpRequest();
		xhrRef.current = xhr;

		xhr.upload.addEventListener("progress", (e) => {
			if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
		});

		xhr.open("POST", `/api/volume-backup/upload?volumeBackupId=${encodeURIComponent(id)}&volumeName=${encodeURIComponent(localVolumeName.trim())}`);
		xhr.setRequestHeader("Content-Type", "application/octet-stream");

		xhr.onload = () => {
			xhrRef.current = null;
			setIsUploading(false);
			if (xhr.status === 200) {
				setUploadStatus("success");
				setUploadProgress(100);
				toast.success("Volume restored successfully from local file!");
			} else {
				setUploadStatus("error");
				try { setUploadError(JSON.parse(xhr.responseText).error || "Upload failed"); }
				catch { setUploadError("Upload failed with status " + xhr.status); }
			}
		};
		xhr.onerror = () => { xhrRef.current = null; setIsUploading(false); setUploadStatus("error"); setUploadError("Network error during upload"); };
		xhr.onabort = () => { xhrRef.current = null; setIsUploading(false); setUploadStatus("idle"); setUploadProgress(0); };
		xhr.send(selectedFile);
	};

	const handleDialogClose = (open: boolean) => {
		if (!open && isUploading) handleUploadCancel();
		if (!open) {
			setSelectedFile(null); setUploadStatus("idle"); setUploadProgress(0);
			setUploadError(""); setLocalVolumeName("");
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
		setIsOpen(open);
	};

	const { data: destinations = [] } = api.destination.all.useQuery();

	const form = useForm({
		defaultValues: {
			destinationId: "",
			backupFile: "",
			volumeName: "",
		},
		resolver: zodResolver(RestoreBackupSchema),
	});

	const destinationId = form.watch("destinationId");
	const volumeName = form.watch("volumeName");
	const backupFile = form.watch("backupFile");

	const debouncedSetSearch = debounce((value: string) => {
		setDebouncedSearchTerm(value);
	}, 350);

	const handleSearchChange = (value: string) => {
		setSearch(value);
		debouncedSetSearch(value);
	};

	const { data: files = [], isPending } = api.backup.listBackupFiles.useQuery(
		{
			destinationId: destinationId,
			search: debouncedSearchTerm,
			serverId: serverId ?? "",
		},
		{
			enabled: isOpen && !!destinationId,
		},
	);

	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [filteredLogs, setFilteredLogs] = useState<LogLine[]>([]);
	const [isDeploying, setIsDeploying] = useState(false);

	api.volumeBackups.restoreVolumeBackupWithLogs.useSubscription(
		{
			id,
			serviceType: type,
			serverId,
			destinationId,
			volumeName,
			backupFileName: backupFile,
		},
		{
			enabled: isDeploying,
			onData(log) {
				if (!isDrawerOpen) {
					setIsDrawerOpen(true);
				}

				if (log === "Restore completed successfully!") {
					setIsDeploying(false);
				}
				const parsedLogs = parseLogs(log);
				setFilteredLogs((prev) => [...prev, ...parsedLogs]);
			},
			onError(error) {
				console.error("Restore logs error:", error);
				setIsDeploying(false);
			},
		},
	);

	const onSubmit = async () => {
		setIsDeploying(true);
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleDialogClose}>
			<DialogTrigger asChild>
				<Button variant="outline">
					<RotateCcw className="mr-2 size-4" />
					Restore Volume Backup
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center">
						<RotateCcw className="mr-2 size-4" />
						Restore Volume Backup
					</DialogTitle>
					<DialogDescription>
						Restore from S3 destination or upload a local .tar file
					</DialogDescription>
					<AlertBlock>
						Make sure the volume name is not being used by another container.
					</AlertBlock>
				</DialogHeader>

				<Tabs defaultValue="s3">
					<TabsList className="w-full">
						<TabsTrigger value="s3" className="flex-1">From S3 Destination</TabsTrigger>
						<TabsTrigger value="local" className="flex-1">Upload Local File</TabsTrigger>
					</TabsList>

					{/* S3 Restore Tab */}
					<TabsContent value="s3">
						<Form {...form}>
							<form
								id="hook-form-restore-backup"
								onSubmit={form.handleSubmit(onSubmit)}
								className="grid w-full gap-4 pt-2"
							>
								<FormField
									control={form.control}
									name="destinationId"
									render={({ field }) => (
										<FormItem className="">
											<FormLabel>Destination</FormLabel>
											<Popover>
												<PopoverTrigger asChild>
													<FormControl>
														<Button
															variant="outline"
															className={cn(
																"w-full justify-between !bg-input",
																!field.value && "text-muted-foreground",
															)}
														>
															{field.value
																? destinations.find(
																		(d) => d.destinationId === field.value,
																	)?.name
																: "Select Destination"}
															<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent className="p-0" align="start">
													<Command>
														<CommandInput
															placeholder="Search destinations..."
															className="h-9"
														/>
														<CommandEmpty>No destinations found.</CommandEmpty>
														<ScrollArea className="h-64">
															<CommandGroup>
																{destinations.map((destination) => (
																	<CommandItem
																		value={destination.destinationId}
																		key={destination.destinationId}
																		onSelect={() => {
																			form.setValue(
																				"destinationId",
																				destination.destinationId,
																			);
																		}}
																	>
																		{destination.name}
																		<CheckIcon
																			className={cn(
																				"ml-auto h-4 w-4",
																				destination.destinationId === field.value
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
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="backupFile"
									render={({ field }) => (
										<FormItem className="">
											<FormLabel className="flex items-center">
												Search Backup Files
												{field.value && (
													<Badge variant="outline" className="truncate w-52">
														{field.value}
														<Copy
															className="ml-2 size-4 cursor-pointer"
															onClick={(e) => {
																e.stopPropagation();
																e.preventDefault();
																copy(field.value);
																toast.success("Backup file copied to clipboard");
															}}
														/>
													</Badge>
												)}
											</FormLabel>
											<Popover modal>
												<PopoverTrigger asChild>
													<FormControl>
														<Button
															variant="outline"
															className={cn(
																"w-full justify-between !bg-input",
																!field.value && "text-muted-foreground",
															)}
														>
															<span className="truncate text-left flex-1 w-52">
																{field.value || "Search and select a backup file"}
															</span>
															<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent className="p-0 w-[min(460px,90vw)]" align="start">
													<Command>
														<CommandInput
															placeholder="Search backup files..."
															value={search}
															onValueChange={handleSearchChange}
															className="h-9"
														/>
														{isPending ? (
															<div className="py-6 text-center text-sm">
																Loading backup files...
															</div>
														) : files.length === 0 && search ? (
															<div className="py-6 text-center text-sm text-muted-foreground">
																No backup files found for "{search}"
															</div>
														) : files.length === 0 ? (
															<div className="py-6 text-center text-sm text-muted-foreground">
																No backup files available
															</div>
														) : (
															<ScrollArea className="h-64">
																<CommandGroup>
																	{files?.map((file) => (
																		<CommandItem
																			value={file.Path}
																			key={file.Path}
																			className="flex items-start gap-2"
																			onSelect={() => {
																				form.setValue("backupFile", file.Path);
																				if (file.IsDir) {
																					setSearch(`${file.Path}/`);
																					setDebouncedSearchTerm(`${file.Path}/`);
																				} else {
																					setSearch(file.Path);
																					setDebouncedSearchTerm(file.Path);
																				}
																			}}
																		>
																			<div className="flex w-full min-w-0 flex-col gap-1">
																				<div className="flex w-full items-center gap-2">
																					<span className="font-medium text-sm break-all leading-tight flex-1" title={file.Path}>
																						{file.Path}
																					</span>
																					<CheckIcon
																						className={cn(
																							"h-4 w-4 shrink-0",
																							file.Path === field.value
																								? "opacity-100"
																								: "opacity-0",
																						)}
																					/>
																				</div>
																				<div className="flex items-center gap-4 text-xs text-muted-foreground">
																					<span>Size: {formatBytes(file.Size)}</span>
																					{file.IsDir && <span className="text-blue-500">Directory</span>}
																					{file.Hashes?.MD5 && <span className="truncate max-w-[120px]">MD5: {file.Hashes.MD5}</span>}
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
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="volumeName"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Volume Name</FormLabel>
											<FormControl>
												<Input placeholder="e.g. myapp-postgres_data" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<DialogFooter>
									<Button
										isLoading={isDeploying}
										form="hook-form-restore-backup"
										type="submit"
									>
										Restore
									</Button>
								</DialogFooter>
							</form>
						</Form>
					</TabsContent>

					{/* Local Upload Tab */}
					<TabsContent value="local">
						<div className="flex flex-col gap-4 pt-2">
							<AlertBlock type="warning">
								Upload a <code className="font-mono text-xs">.tar</code> file from your local PC to restore the volume. The file will be removed from the server after restoration.
							</AlertBlock>

							<div className="flex flex-col gap-2">
								<Label>Volume Name</Label>
								<Input
									placeholder="e.g. myapp-postgres_data"
									value={localVolumeName}
									onChange={(e) => setLocalVolumeName(e.target.value)}
									disabled={isUploading}
								/>
								<p className="text-xs text-muted-foreground">
									The exact Docker volume name to restore into
								</p>
							</div>

							<div className="flex flex-col gap-2">
								<Label>Backup File (.tar)</Label>
								<Input
									ref={fileInputRef}
									type="file"
									accept=".tar"
									onChange={handleFileChange}
									disabled={isUploading}
									className="cursor-pointer"
								/>
								{selectedFile && (
									<div className="flex items-center justify-between text-sm text-muted-foreground border rounded px-3 py-2">
										<span className="truncate flex-1 mr-2">{selectedFile.name}</span>
										<span className="shrink-0 text-xs">
											{(selectedFile.size / 1024 / 1024).toFixed(1)} MB
										</span>
									</div>
								)}
							</div>

							{(isUploading || uploadStatus === "success") && (
								<div className="flex flex-col gap-2">
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">
											{uploadStatus === "success"
												? "Restore complete"
												: uploadProgress < 100
													? `Uploading... ${uploadProgress}%`
													: "Restoring volume..."}
										</span>
										<span className="font-medium">{uploadProgress}%</span>
									</div>
									<Progress value={uploadProgress} className="h-2" />
								</div>
							)}

							{uploadStatus === "error" && uploadError && (
								<AlertBlock type="error">{uploadError}</AlertBlock>
							)}
							{uploadStatus === "success" && (
								<AlertBlock type="success">
									Volume <strong>{localVolumeName}</strong> restored successfully!
								</AlertBlock>
							)}

							<DialogFooter className="gap-2 sm:gap-0">
								{isUploading ? (
									<Button variant="outline" onClick={handleUploadCancel} className="gap-2">
										<X className="size-4" />
										Cancel Upload
									</Button>
								) : uploadStatus === "success" ? (
									<Button variant="outline" onClick={() => handleDialogClose(false)}>
										Close
									</Button>
								) : (
									<Button
										onClick={handleUpload}
										disabled={!selectedFile || !localVolumeName.trim() || isUploading}
										className="gap-2"
									>
										<Upload className="size-4" />
										Upload & Restore
									</Button>
								)}
							</DialogFooter>
						</div>
					</TabsContent>
				</Tabs>

				<DrawerLogs
					isOpen={isDrawerOpen}
					onClose={() => {
						setIsDrawerOpen(false);
						setFilteredLogs([]);
						setIsDeploying(false);
					}}
					filteredLogs={filteredLogs}
				/>
			</DialogContent>
		</Dialog>
	);
};
