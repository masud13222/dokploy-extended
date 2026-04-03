import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Loader2, MoreHorizontal, RotateCcw } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/utils/api";
import { ShowContainerConfig } from "../config/show-container-config";
import { ShowDockerModalLogs } from "../logs/show-docker-modal-logs";
import { RemoveContainerDialog } from "../remove/remove-container";
import { DockerTerminalModal } from "../terminal/docker-terminal-modal";
import type { Container } from "./show-containers";

const RestartContainerItem = ({
	containerId,
	serverId,
}: {
	containerId: string;
	serverId?: string;
}) => {
	const [isRestarting, setIsRestarting] = useState(false);
	const { mutateAsync: restartContainer } =
		api.docker.restartContainer.useMutation();

	return (
		<button
			type="button"
			className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full disabled:pointer-events-none disabled:opacity-50"
			disabled={isRestarting}
			onClick={async (e: React.MouseEvent) => {
				e.preventDefault();
				setIsRestarting(true);
				try {
					await restartContainer({ containerId, serverId });
					toast.success("Container restarted successfully");
				} catch (err) {
					toast.error(
						err instanceof Error ? err.message : "Failed to restart container",
					);
				} finally {
					setIsRestarting(false);
				}
			}}
		>
			{isRestarting ? (
				<Loader2 className="size-4 animate-spin" />
			) : (
				<RotateCcw className="size-4" />
			)}
			Restart
		</button>
	);
};

export const columns: ColumnDef<Container>[] = [
	{
		accessorKey: "name",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Name
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		cell: ({ row }) => {
			return <div>{row.getValue("name")}</div>;
		},
	},
	{
		accessorKey: "state",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					State
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		cell: ({ row }) => {
			const value = row.getValue("state") as string;
			return (
				<div className="capitalize">
					<Badge
						variant={
							value === "running"
								? "default"
								: value === "failed"
									? "destructive"
									: "secondary"
						}
					>
						{value}
					</Badge>
				</div>
			);
		},
	},
	{
		accessorKey: "status",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Status
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		cell: ({ row }) => {
			return <div className="capitalize">{row.getValue("status")}</div>;
		},
	},
	{
		accessorKey: "image",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Image
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		cell: ({ row }) => <div className="lowercase">{row.getValue("image")}</div>,
	},
	{
		id: "actions",
		enableHiding: false,
		cell: ({ row }) => {
			const container = row.original;

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="h-8 w-8 p-0">
							<span className="sr-only">Open menu</span>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuLabel>Actions</DropdownMenuLabel>
						<RestartContainerItem
							containerId={container.containerId}
							serverId={container.serverId ?? undefined}
						/>
						<DropdownMenuSeparator />
						<ShowDockerModalLogs
							containerId={container.containerId}
							serverId={container.serverId}
						>
							View Logs
						</ShowDockerModalLogs>
						<ShowContainerConfig
							containerId={container.containerId}
							serverId={container.serverId || ""}
						/>
						<DockerTerminalModal
							containerId={container.containerId}
							serverId={container.serverId || ""}
						>
							Terminal
						</DockerTerminalModal>
						<RemoveContainerDialog
							containerId={container.containerId}
							serverId={container.serverId ?? undefined}
						/>
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
	},
];
