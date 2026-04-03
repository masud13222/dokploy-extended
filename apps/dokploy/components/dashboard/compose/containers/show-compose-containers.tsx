import {
	Loader2,
	RefreshCw,
	RotateCcw,
	Server,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DialogAction } from "@/components/shared/dialog-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/utils/api";

interface Props {
	appName: string;
	appType: "docker-compose" | "stack";
	serverId?: string;
}

const getStateBadge = (state: string) => {
	const s = state.toLowerCase();
	if (s === "running") return "default";
	if (s === "exited" || s === "dead") return "destructive";
	if (s === "paused" || s === "restarting") return "secondary";
	return "outline";
};

export const ShowComposeContainers = ({
	appName,
	appType,
	serverId,
}: Props) => {
	const [restartingIds, setRestartingIds] = useState<Set<string>>(new Set());
	const [recreatingIds, setRecreatingIds] = useState<Set<string>>(new Set());

	const {
		data: containers = [],
		isLoading,
		refetch,
		isRefetching,
	} = api.docker.getContainersByAppNameMatch.useQuery(
		{
			appName,
			appType,
			serverId,
		},
		{
			refetchInterval: 10000,
		},
	);

	const { mutateAsync: restartContainer } =
		api.docker.restartContainer.useMutation();

	const { mutateAsync: removeContainer } =
		api.docker.removeContainer.useMutation();

	const handleRestart = async (containerId: string) => {
		setRestartingIds((prev) => new Set(prev).add(containerId));
		try {
			await restartContainer({ containerId, serverId });
			toast.success("Container restarted successfully");
			await refetch();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to restart container",
			);
		} finally {
			setRestartingIds((prev) => {
				const next = new Set(prev);
				next.delete(containerId);
				return next;
			});
		}
	};

	const handleRecreate = async (containerId: string) => {
		setRecreatingIds((prev) => new Set(prev).add(containerId));
		try {
			await removeContainer({ containerId, serverId });
			toast.success("Container removed — Docker Compose will recreate it on next deploy");
			await refetch();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to remove container",
			);
		} finally {
			setRecreatingIds((prev) => {
				const next = new Set(prev);
				next.delete(containerId);
				return next;
			});
		}
	};

	return (
		<Card className="border px-6 shadow-none bg-transparent h-full min-h-[50vh]">
			<CardHeader className="px-0">
				<div className="flex justify-between items-center flex-wrap gap-2">
					<div className="flex flex-col gap-2">
						<CardTitle className="text-xl font-bold flex items-center gap-2">
							<Server className="size-5" />
							Containers
						</CardTitle>
						<CardDescription>
							All containers for this compose project. Auto-refreshes every 10s.
						</CardDescription>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						disabled={isRefetching}
					>
						{isRefetching ? (
							<Loader2 className="mr-2 size-4 animate-spin" />
						) : (
							<RefreshCw className="mr-2 size-4" />
						)}
						Refresh
					</Button>
				</div>
			</CardHeader>
			<CardContent className="px-0">
				{isLoading ? (
					<div className="flex gap-3 items-center justify-center min-h-[40vh] text-muted-foreground">
						<Loader2 className="size-5 animate-spin" />
						<span className="text-sm">Loading containers...</span>
					</div>
				) : containers.length === 0 ? (
					<div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
						<Server className="size-10 text-muted-foreground" />
						<p className="text-muted-foreground text-sm">No containers found</p>
						<p className="text-muted-foreground text-xs">
							Deploy this compose project to see containers here.
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-2">
						{containers.map((container) => (
							<div
								key={container.containerId}
								className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 bg-muted/50 gap-3"
							>
								<div className="flex items-center gap-3 min-w-0">
									<div className="flex flex-col gap-1 min-w-0">
										<div className="flex items-center gap-2 flex-wrap">
											<span className="text-sm font-medium truncate max-w-[300px]">
												{container.name}
											</span>
											<Badge variant={getStateBadge(container.state)}>
												{container.state}
											</Badge>
										</div>
										{container.status && (
											<span className="text-xs text-muted-foreground">
												{container.status}
											</span>
										)}
										<span className="text-xs text-muted-foreground font-mono">
											{container.containerId.slice(0, 12)}
										</span>
									</div>
								</div>
								<div className="flex items-center gap-2 shrink-0">
									<TooltipProvider delayDuration={0}>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="outline"
													size="sm"
													disabled={restartingIds.has(container.containerId)}
													onClick={() => handleRestart(container.containerId)}
												>
													{restartingIds.has(container.containerId) ? (
														<Loader2 className="size-4 animate-spin" />
													) : (
														<RotateCcw className="size-4" />
													)}
													<span className="ml-1.5">Restart</span>
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												Restart this container
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
									<TooltipProvider delayDuration={0}>
										<Tooltip>
											<TooltipTrigger asChild>
												<div>
													<DialogAction
														title="Recreate Container"
														description={`This will remove the container "${container.name}" and it will be recreated on the next deploy. Are you sure?`}
														type="destructive"
														onClick={() => handleRecreate(container.containerId)}
													>
														<Button
															variant="outline"
															size="sm"
															disabled={recreatingIds.has(container.containerId)}
															className="group hover:border-red-500/50 hover:text-red-500"
														>
															{recreatingIds.has(container.containerId) ? (
																<Loader2 className="size-4 animate-spin" />
															) : (
																<Trash2 className="size-4 group-hover:text-red-500" />
															)}
															<span className="ml-1.5">Recreate</span>
														</Button>
													</DialogAction>
												</div>
											</TooltipTrigger>
											<TooltipContent>
												Remove container (will be recreated on next deploy)
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
