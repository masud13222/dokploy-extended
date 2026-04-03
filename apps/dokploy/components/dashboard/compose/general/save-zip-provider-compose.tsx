import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { FileArchive, TrashIcon, UploadCloud } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/ui/dropzone";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { api } from "@/utils/api";
import { type UploadComposeFile, uploadComposeFileSchema } from "@/utils/schema";

interface Props {
	composeId: string;
}

export const SaveZipProviderCompose = ({ composeId }: Props) => {
	const { mutateAsync, isPending } = api.compose.dropDeployment.useMutation();

	const form = useForm<UploadComposeFile>({
		defaultValues: { zip: undefined },
		resolver: zodResolver(uploadComposeFileSchema),
	});

	const zip = form.watch("zip");

	const onSubmit = async (values: UploadComposeFile) => {
		const formData = new FormData();
		formData.append("zip", values.zip);
		formData.append("composeId", composeId);

		await mutateAsync(formData as unknown as { composeId: string; zip: File })
			.then(() => {
				toast.success("ZIP uploaded — deployment started");
				form.reset();
			})
			.catch((err) => {
				toast.error("Upload failed", {
					description: err instanceof Error ? err.message : "Unknown error",
				});
			});
	};

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="flex flex-col gap-4"
			>
				<AlertBlock type="info">
					Upload a <strong>.zip</strong> file containing your{" "}
					<code>docker-compose.yml</code>. The file will be extracted, set as
					the Raw compose source, and deployed immediately.
					<br />
					<span className="text-xs mt-1 block text-muted-foreground">
						Accepted filenames inside ZIP:{" "}
						<code>docker-compose.yml</code>,{" "}
						<code>docker-compose.yaml</code>,{" "}
						<code>compose.yml</code>,{" "}
						<code>compose.yaml</code>
					</span>
				</AlertBlock>

				<FormField
					control={form.control}
					name="zip"
					render={({ field }) => (
						<FormItem>
							<FormLabel>ZIP file</FormLabel>
							<FormControl>
								<Dropzone
									{...field}
									dropMessage="Drop your .zip here or click to browse"
									accept=".zip"
									onChange={(e) => {
										if (e instanceof FileList) {
											field.onChange(e[0]);
										} else {
											field.onChange(e);
										}
									}}
								/>
							</FormControl>
							<FormMessage />
							{zip instanceof File && (
								<div className="flex items-center gap-3 mt-2 p-2 rounded-md border bg-muted/30">
									<FileArchive className="size-4 text-muted-foreground shrink-0" />
									<span className="text-sm text-muted-foreground truncate flex-1">
										{zip.name}{" "}
										<span className="text-xs">
											({(zip.size / 1024).toFixed(1)} KB)
										</span>
									</span>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="shrink-0"
										onClick={() => field.onChange(null)}
									>
										<TrashIcon className="size-4 text-muted-foreground" />
									</Button>
								</div>
							)}
						</FormItem>
					)}
				/>

				<div className="flex justify-end">
					<Button
						type="submit"
						isLoading={isPending}
						disabled={!zip || isPending}
						className="gap-2"
					>
						<UploadCloud className="size-4" />
						Upload & Deploy
					</Button>
				</div>
			</form>
		</Form>
	);
};
