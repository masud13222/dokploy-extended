import { Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { api } from "@/utils/api";

interface Props {
	volumeBackupId: string;
	volumeName: string;
}

export const RestoreVolumeBackupLocal = ({
	volumeBackupId,
	volumeName,
}: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadStatus, setUploadStatus] = useState<
		"idle" | "uploading" | "success" | "error"
	>("idle");
	const [errorMessage, setErrorMessage] = useState<string>("");
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
			setErrorMessage("");
			setUploadProgress(0);
		}
	};

	const handleCancel = () => {
		if (xhrRef.current && isUploading) {
			xhrRef.current.abort();
			xhrRef.current = null;
		}
		setIsUploading(false);
		setUploadStatus("idle");
		setUploadProgress(0);
		setSelectedFile(null);
		setErrorMessage("");
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const handleUpload = async () => {
		if (!selectedFile) {
			toast.error("Please select a .tar file first");
			return;
		}

		setIsUploading(true);
		setUploadStatus("uploading");
		setUploadProgress(0);
		setErrorMessage("");

		const xhr = new XMLHttpRequest();
		xhrRef.current = xhr;

		xhr.upload.addEventListener("progress", (event) => {
			if (event.lengthComputable) {
				const percent = Math.round((event.loaded / event.total) * 100);
				setUploadProgress(percent);
			}
		});

		const uploadUrl = `/api/volume-backup/upload?volumeBackupId=${encodeURIComponent(
			volumeBackupId,
		)}&volumeName=${encodeURIComponent(volumeName)}`;

		xhr.open("POST", uploadUrl);
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
				try {
					const body = JSON.parse(xhr.responseText);
					setErrorMessage(body.error || "Upload failed");
				} catch {
					setErrorMessage("Upload failed with status " + xhr.status);
				}
			}
		};

		xhr.onerror = () => {
			xhrRef.current = null;
			setIsUploading(false);
			setUploadStatus("error");
			setErrorMessage("Network error during upload");
		};

		xhr.onabort = () => {
			xhrRef.current = null;
			setIsUploading(false);
			setUploadStatus("idle");
			setUploadProgress(0);
			toast.info("Upload cancelled");
		};

		xhr.send(selectedFile);
	};

	const handleOpenChange = (open: boolean) => {
		if (!open && isUploading) {
			handleCancel();
		}
		if (!open) {
			setSelectedFile(null);
			setUploadStatus("idle");
			setUploadProgress(0);
			setErrorMessage("");
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
		setIsOpen(open);
	};

	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="gap-2">
					<Upload className="size-4" />
					Upload & Restore
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Restore from Local File</DialogTitle>
					<DialogDescription>
						Upload a local <code>.tar</code> backup file to restore the volume{" "}
						<strong className="font-mono">{volumeName}</strong>. The file will
						be removed from the server after restoration.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					<AlertBlock type="warning">
						This will overwrite the existing volume data. Make sure no container
						is actively using the volume before restoring.
					</AlertBlock>

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
									{formatFileSize(selectedFile.size)}
								</span>
							</div>
						)}
					</div>

					{(isUploading || uploadStatus === "success") && (
						<div className="flex flex-col gap-2">
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">
									{uploadStatus === "success"
										? "Upload & restore complete"
										: uploadProgress < 100
											? `Uploading... ${uploadProgress}%`
											: "Restoring volume..."}
								</span>
								<span className="font-medium">{uploadProgress}%</span>
							</div>
							<Progress value={uploadProgress} className="h-2" />
						</div>
					)}

					{uploadStatus === "error" && errorMessage && (
						<AlertBlock type="error">{errorMessage}</AlertBlock>
					)}

					{uploadStatus === "success" && (
						<AlertBlock type="success">
							Volume <strong>{volumeName}</strong> has been successfully
							restored!
						</AlertBlock>
					)}
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					{isUploading ? (
						<Button variant="outline" onClick={handleCancel} className="gap-2">
							<X className="size-4" />
							Cancel Upload
						</Button>
					) : (
						<>
							<Button
								variant="outline"
								onClick={() => handleOpenChange(false)}
								disabled={isUploading}
							>
								{uploadStatus === "success" ? "Close" : "Cancel"}
							</Button>
							{uploadStatus !== "success" && (
								<Button
									onClick={handleUpload}
									disabled={!selectedFile || isUploading}
									className="gap-2"
								>
									<Upload className="size-4" />
									Upload & Restore
								</Button>
							)}
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
