import { FileArchive, Loader2, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Props {
	composeId: string;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

export const SaveZipProviderCompose = ({ composeId }: Props) => {
	const [file, setFile] = useState<File | null>(null);
	const [progress, setProgress] = useState(0);
	const [status, setStatus] = useState<UploadStatus>("idle");
	const [errorMsg, setErrorMsg] = useState<string>("");
	const xhrRef = useRef<XMLHttpRequest | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const reset = () => {
		setFile(null);
		setProgress(0);
		setStatus("idle");
		setErrorMsg("");
		if (inputRef.current) inputRef.current.value = "";
	};

	const handleCancel = () => {
		xhrRef.current?.abort();
		reset();
		toast.info("Upload cancelled");
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selected = e.target.files?.[0];
		if (!selected) return;
		if (!selected.name.toLowerCase().endsWith(".zip")) {
			toast.error("Only .zip files are accepted");
			return;
		}
		setFile(selected);
		setStatus("idle");
		setErrorMsg("");
		setProgress(0);
	};

	const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		const dropped = e.dataTransfer.files[0];
		if (!dropped) return;
		if (!dropped.name.toLowerCase().endsWith(".zip")) {
			toast.error("Only .zip files are accepted");
			return;
		}
		setFile(dropped);
		setStatus("idle");
		setErrorMsg("");
		setProgress(0);
	};

	const handleUpload = () => {
		if (!file) return;

		setStatus("uploading");
		setProgress(0);
		setErrorMsg("");

		const xhr = new XMLHttpRequest();
		xhrRef.current = xhr;

		xhr.upload.addEventListener("progress", (e) => {
			if (e.lengthComputable) {
				setProgress(Math.round((e.loaded / e.total) * 100));
			}
		});

		xhr.addEventListener("load", () => {
			if (xhr.status === 200) {
				setStatus("success");
				setProgress(100);
				toast.success("ZIP uploaded — deployment started");
			} else {
				let msg = "Upload failed";
				try {
					const body = JSON.parse(xhr.responseText);
					msg = body.error || msg;
				} catch (_) {}
				setStatus("error");
				setErrorMsg(msg);
				toast.error(msg);
			}
			xhrRef.current = null;
		});

		xhr.addEventListener("error", () => {
			setStatus("error");
			setErrorMsg("Network error — check your connection");
			toast.error("Network error during upload");
			xhrRef.current = null;
		});

		xhr.addEventListener("abort", () => {
			setStatus("idle");
			xhrRef.current = null;
		});

		xhr.open("POST", `/api/compose/zip-upload?composeId=${encodeURIComponent(composeId)}`);
		xhr.send(file);
	};

	const isUploading = status === "uploading";

	return (
		<div className="flex flex-col gap-4">
			<AlertBlock type="info">
				Upload a <strong>.zip</strong> file containing your{" "}
				<code className="text-xs bg-muted px-1 py-0.5 rounded">docker-compose.yml</code>.
				The compose file will be extracted, saved as the Raw source, and
				deployed immediately.
				<br />
				<span className="text-xs mt-1 block text-muted-foreground">
					Accepted filenames inside ZIP:{" "}
					<code>docker-compose.yml</code>, <code>docker-compose.yaml</code>,{" "}
					<code>compose.yml</code>, <code>compose.yaml</code>
				</span>
			</AlertBlock>

			{/* Drop zone */}
			<div
				className={[
					"relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer",
					isUploading
						? "border-muted pointer-events-none opacity-60"
						: "border-border hover:border-primary/50 hover:bg-muted/20",
					status === "success" && "border-green-500/50 bg-green-500/5",
					status === "error" && "border-destructive/50 bg-destructive/5",
				]
					.filter(Boolean)
					.join(" ")}
				onDragOver={(e) => e.preventDefault()}
				onDrop={handleDrop}
				onClick={() => !isUploading && inputRef.current?.click()}
			>
				<input
					ref={inputRef}
					type="file"
					accept=".zip"
					className="hidden"
					onChange={handleFileChange}
					disabled={isUploading}
				/>

				{file ? (
					<>
						<FileArchive className="size-10 text-muted-foreground" />
						<div className="text-center">
							<p className="text-sm font-medium truncate max-w-[300px]">
								{file.name}
							</p>
							<p className="text-xs text-muted-foreground mt-0.5">
								{(file.size / 1024).toFixed(1)} KB
							</p>
						</div>
					</>
				) : (
					<>
						<UploadCloud className="size-10 text-muted-foreground" />
						<div className="text-center">
							<p className="text-sm font-medium">
								Drop your .zip file here or click to browse
							</p>
							<p className="text-xs text-muted-foreground mt-0.5">
								Only .zip files accepted
							</p>
						</div>
					</>
				)}
			</div>

			{/* Progress bar */}
			{isUploading && (
				<div className="flex flex-col gap-1.5">
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>Uploading...</span>
						<span>{progress}%</span>
					</div>
					<Progress value={progress} className="h-2" />
				</div>
			)}

			{/* Status messages */}
			{status === "success" && (
				<AlertBlock type="success">
					ZIP uploaded successfully. Deployment has been queued — check the
					Deployments tab for progress.
				</AlertBlock>
			)}

			{status === "error" && errorMsg && (
				<AlertBlock type="error">{errorMsg}</AlertBlock>
			)}

			{/* Action buttons */}
			<div className="flex justify-end gap-2">
				{file && !isUploading && status !== "success" && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={reset}
					>
						<X className="size-4 mr-1.5" />
						Clear
					</Button>
				)}

				{isUploading ? (
					<Button
						type="button"
						variant="destructive"
						size="sm"
						onClick={handleCancel}
					>
						<X className="size-4 mr-1.5" />
						Cancel Upload
					</Button>
				) : status === "success" ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={reset}
					>
						Upload Another
					</Button>
				) : (
					<Button
						type="button"
						size="sm"
						disabled={!file}
						onClick={handleUpload}
						className="gap-2"
					>
						<UploadCloud className="size-4" />
						Upload & Deploy
					</Button>
				)}
			</div>
		</div>
	);
};
